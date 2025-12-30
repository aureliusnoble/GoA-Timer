-- Migration: Global Hero Statistics
-- Purpose: Create materialized views and functions for global hero statistics
-- Run this in Supabase SQL Editor

-- ============================================
-- GLOBAL HERO STATISTICS - MATERIALIZED VIEWS
-- ============================================

-- Create a materialized view for hero base statistics
-- Deduplicates matches by grouping on date + winning_team + player counts
CREATE MATERIALIZED VIEW IF NOT EXISTS global_hero_stats AS
WITH deduplicated_matches AS (
  -- Deduplicate matches by grouping on key identifying features
  -- This handles the case where multiple users upload the same match
  SELECT DISTINCT ON (
    DATE_TRUNC('minute', date),
    winning_team,
    game_length,
    titan_players,
    atlantean_players
  )
    id as match_id,
    date,
    winning_team,
    game_length
  FROM cloud_matches
  ORDER BY
    DATE_TRUNC('minute', date),
    winning_team,
    game_length,
    titan_players,
    atlantean_players,
    synced_at DESC  -- Pick most recent sync
),
hero_match_data AS (
  SELECT
    cmp.hero_id,
    cmp.hero_name,
    cmp.team,
    dm.winning_team,
    dm.match_id
  FROM cloud_match_players cmp
  INNER JOIN deduplicated_matches dm ON cmp.match_id = dm.match_id
)
SELECT
  hero_id,
  hero_name,
  COUNT(*)::INTEGER as total_games,
  SUM(CASE WHEN team = winning_team THEN 1 ELSE 0 END)::INTEGER as wins,
  SUM(CASE WHEN team != winning_team THEN 1 ELSE 0 END)::INTEGER as losses,
  ROUND(
    100.0 * SUM(CASE WHEN team = winning_team THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  )::NUMERIC as win_rate,
  NOW() as refreshed_at
FROM hero_match_data
GROUP BY hero_id, hero_name;

-- Create unique index for fast lookups and CONCURRENTLY refresh support
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_hero_stats_hero_id
ON global_hero_stats(hero_id);

-- ============================================
-- GLOBAL HERO RELATIONSHIPS VIEW
-- ============================================

-- Create a materialized view for hero relationships (teammates and opponents)
CREATE MATERIALIZED VIEW IF NOT EXISTS global_hero_relationships AS
WITH deduplicated_matches AS (
  SELECT DISTINCT ON (
    DATE_TRUNC('minute', date),
    winning_team,
    game_length,
    titan_players,
    atlantean_players
  )
    id as match_id,
    date,
    winning_team
  FROM cloud_matches
  ORDER BY
    DATE_TRUNC('minute', date),
    winning_team,
    game_length,
    titan_players,
    atlantean_players,
    synced_at DESC
),
match_heroes AS (
  SELECT
    cmp.hero_id,
    cmp.hero_name,
    cmp.team,
    dm.winning_team,
    dm.match_id
  FROM cloud_match_players cmp
  INNER JOIN deduplicated_matches dm ON cmp.match_id = dm.match_id
),
-- Teammate relationships (both directions)
teammate_pairs AS (
  SELECT
    h1.hero_id as hero_id,
    h2.hero_id as related_hero_id,
    h2.hero_name as related_hero_name,
    'teammate' as relationship_type,
    CASE WHEN h1.team = h1.winning_team THEN 1 ELSE 0 END as won
  FROM match_heroes h1
  INNER JOIN match_heroes h2
    ON h1.match_id = h2.match_id
    AND h1.team = h2.team
    AND h1.hero_id != h2.hero_id
),
-- Opponent relationships
opponent_pairs AS (
  SELECT
    h1.hero_id as hero_id,
    h2.hero_id as related_hero_id,
    h2.hero_name as related_hero_name,
    'opponent' as relationship_type,
    CASE WHEN h1.team = h1.winning_team THEN 1 ELSE 0 END as won
  FROM match_heroes h1
  INNER JOIN match_heroes h2
    ON h1.match_id = h2.match_id
    AND h1.team != h2.team
)
SELECT
  hero_id,
  related_hero_id,
  related_hero_name,
  relationship_type,
  COUNT(*)::INTEGER as games_played,
  SUM(won)::INTEGER as wins,
  ROUND(100.0 * SUM(won) / NULLIF(COUNT(*), 0), 2)::NUMERIC as win_rate,
  NOW() as refreshed_at
FROM (
  SELECT * FROM teammate_pairs
  UNION ALL
  SELECT * FROM opponent_pairs
) combined
GROUP BY hero_id, related_hero_id, related_hero_name, relationship_type;

-- Create indexes for relationship lookups
CREATE INDEX IF NOT EXISTS idx_global_hero_rel_hero
ON global_hero_relationships(hero_id);

CREATE INDEX IF NOT EXISTS idx_global_hero_rel_type
ON global_hero_relationships(relationship_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_hero_rel_unique
ON global_hero_relationships(hero_id, related_hero_id, relationship_type);

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Function to get global hero statistics with relationships (bypasses RLS)
CREATE OR REPLACE FUNCTION get_global_hero_stats_full(
  min_games_hero INTEGER DEFAULT 1,
  min_games_relationship INTEGER DEFAULT 3
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(hero_data ORDER BY hero_data->>'total_games' DESC)
  INTO result
  FROM (
    SELECT
      json_build_object(
        'hero_id', ghs.hero_id,
        'hero_name', ghs.hero_name,
        'total_games', ghs.total_games,
        'wins', ghs.wins,
        'losses', ghs.losses,
        'win_rate', ghs.win_rate,
        'best_teammates', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'related_hero_id', t.related_hero_id,
              'related_hero_name', t.related_hero_name,
              'games_played', t.games_played,
              'wins', t.wins,
              'win_rate', t.win_rate
            ) ORDER BY t.win_rate DESC
          ), '[]'::json)
          FROM (
            SELECT related_hero_id, related_hero_name, games_played, wins, win_rate
            FROM global_hero_relationships ghr
            WHERE ghr.hero_id = ghs.hero_id
              AND ghr.relationship_type = 'teammate'
              AND ghr.games_played >= min_games_relationship
            ORDER BY ghr.win_rate DESC
            LIMIT 3
          ) t
        ),
        'best_against', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'related_hero_id', o.related_hero_id,
              'related_hero_name', o.related_hero_name,
              'games_played', o.games_played,
              'wins', o.wins,
              'win_rate', o.win_rate
            ) ORDER BY o.win_rate DESC
          ), '[]'::json)
          FROM (
            SELECT related_hero_id, related_hero_name, games_played, wins, win_rate
            FROM global_hero_relationships ghr
            WHERE ghr.hero_id = ghs.hero_id
              AND ghr.relationship_type = 'opponent'
              AND ghr.games_played >= min_games_relationship
            ORDER BY ghr.win_rate DESC
            LIMIT 3
          ) o
        ),
        'worst_against', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'related_hero_id', w.related_hero_id,
              'related_hero_name', w.related_hero_name,
              'games_played', w.games_played,
              'wins', w.wins,
              'win_rate', w.win_rate
            ) ORDER BY w.win_rate ASC
          ), '[]'::json)
          FROM (
            SELECT related_hero_id, related_hero_name, games_played, wins, win_rate
            FROM global_hero_relationships ghr
            WHERE ghr.hero_id = ghs.hero_id
              AND ghr.relationship_type = 'opponent'
              AND ghr.games_played >= min_games_relationship
            ORDER BY ghr.win_rate ASC
            LIMIT 3
          ) w
        )
      ) as hero_data
    FROM global_hero_stats ghs
    WHERE ghs.total_games >= min_games_hero
  ) subq;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to manually refresh the materialized views
CREATE OR REPLACE FUNCTION refresh_global_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_hero_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_hero_relationships;
END;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant execute to both authenticated and anonymous users (no login required)
GRANT EXECUTE ON FUNCTION get_global_hero_stats_full TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_hero_stats_full TO anon;

-- Only service role can refresh stats
REVOKE EXECUTE ON FUNCTION refresh_global_stats FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_global_stats TO service_role;

-- ============================================
-- INITIAL REFRESH
-- ============================================

-- Refresh the views with initial data
REFRESH MATERIALIZED VIEW global_hero_stats;
REFRESH MATERIALIZED VIEW global_hero_relationships;
