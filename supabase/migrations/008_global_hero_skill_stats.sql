-- Migration: Global Hero Skill Stats (G-Formula Impact)
-- Creates a results table for pre-computed hero impact data and an RPC to read it.
-- An Edge Function (compute-hero-skill-stats) populates this table.

-- ============================================
-- RESULTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS global_hero_skill_stats (
  hero_id INTEGER PRIMARY KEY,
  hero_name TEXT NOT NULL,
  ate DOUBLE PRECISION NOT NULL,
  ci_lower DOUBLE PRECISION NOT NULL,
  ci_upper DOUBLE PRECISION NOT NULL,
  games_with_hero INTEGER NOT NULL,
  gradient JSONB NOT NULL DEFAULT '[]',
  gradient_badge TEXT NOT NULL DEFAULT 'balanced',
  victory_profile JSONB NOT NULL DEFAULT '[]',
  win_style_badge TEXT,
  sufficient BOOLEAN NOT NULL DEFAULT false,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_hero_skill_stats_computed
ON global_hero_skill_stats(computed_at);

-- ============================================
-- RPC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_global_hero_skill_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'hero_id', hero_id,
      'hero_name', hero_name,
      'ate', ate,
      'ci_lower', ci_lower,
      'ci_upper', ci_upper,
      'games_with_hero', games_with_hero,
      'gradient', gradient,
      'gradient_badge', gradient_badge,
      'victory_profile', victory_profile,
      'win_style_badge', win_style_badge,
      'sufficient', sufficient
    )
    ORDER BY games_with_hero DESC
  )
  INTO result
  FROM global_hero_skill_stats;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================
-- PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_global_hero_skill_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_hero_skill_stats TO anon;

-- ============================================
-- DATA QUERY VIEW (used by the Edge Function)
-- Provides deduplicated match data with player skill ratings
-- ============================================

CREATE OR REPLACE VIEW hero_skill_match_data AS
WITH deduplicated_matches AS (
  SELECT DISTINCT ON (
    DATE_TRUNC('minute', date),
    winning_team,
    game_length,
    titan_players,
    atlantean_players
  )
    id AS match_id,
    date,
    winning_team,
    game_length,
    owner_id
  FROM cloud_matches
  ORDER BY
    DATE_TRUNC('minute', date),
    winning_team,
    game_length,
    titan_players,
    atlantean_players,
    synced_at DESC
),
match_with_players AS (
  SELECT
    dm.match_id,
    dm.winning_team,
    cmp.hero_id,
    cmp.hero_name,
    cmp.team,
    cmp.player_id,
    dm.owner_id,
    COALESCE(cp.mu, 25.0) AS player_mu
  FROM deduplicated_matches dm
  INNER JOIN cloud_match_players cmp
    ON cmp.match_id = dm.match_id AND cmp.owner_id = dm.owner_id
  LEFT JOIN cloud_players cp
    ON cp.local_id = cmp.player_id AND cp.owner_id = dm.owner_id
)
SELECT
  match_id,
  winning_team,
  hero_id,
  hero_name,
  team,
  player_mu
FROM match_with_players;

-- ============================================
-- DATA QUERY FUNCTION (used by the Edge Function)
-- Returns the view data as JSON, bypassing RLS
-- ============================================

CREATE OR REPLACE FUNCTION get_hero_skill_match_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(d))
  INTO result
  FROM hero_skill_match_data d;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_hero_skill_match_data TO service_role;
