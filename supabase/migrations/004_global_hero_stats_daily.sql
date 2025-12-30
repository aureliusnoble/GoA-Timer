-- Migration: Global Hero Statistics Over Time (Daily)
-- Purpose: Create materialized view and function for hero win rate time series data
-- Run this in Supabase SQL Editor

-- ============================================
-- GLOBAL HERO STATS DAILY - MATERIALIZED VIEW
-- ============================================

-- Create a materialized view for daily hero statistics with cumulative tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS global_hero_stats_daily AS
WITH deduplicated_matches AS (
  -- Same deduplication logic as existing global_hero_stats
  SELECT DISTINCT ON (
    DATE_TRUNC('minute', date),
    winning_team,
    game_length,
    titan_players,
    atlantean_players
  )
    id as match_id,
    DATE(date) as match_date,
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
hero_daily_stats AS (
  -- Aggregate by hero and date
  SELECT
    cmp.hero_id,
    cmp.hero_name,
    dm.match_date,
    COUNT(*)::INTEGER as games_played,
    SUM(CASE WHEN cmp.team = dm.winning_team THEN 1 ELSE 0 END)::INTEGER as wins
  FROM cloud_match_players cmp
  INNER JOIN deduplicated_matches dm ON cmp.match_id = dm.match_id
  GROUP BY cmp.hero_id, cmp.hero_name, dm.match_date
),
hero_cumulative AS (
  -- Calculate cumulative totals using window functions
  SELECT
    hero_id,
    hero_name,
    match_date,
    games_played,
    wins,
    SUM(games_played) OVER (
      PARTITION BY hero_id
      ORDER BY match_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::INTEGER as cumulative_games,
    SUM(wins) OVER (
      PARTITION BY hero_id
      ORDER BY match_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::INTEGER as cumulative_wins
  FROM hero_daily_stats
)
SELECT
  hero_id,
  hero_name,
  match_date,
  games_played,
  wins,
  cumulative_games,
  cumulative_wins,
  ROUND(100.0 * cumulative_wins / NULLIF(cumulative_games, 0), 2)::NUMERIC as cumulative_win_rate,
  NOW() as refreshed_at
FROM hero_cumulative
ORDER BY hero_id, match_date;

-- Create indexes for efficient lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_hero_stats_daily_pk
ON global_hero_stats_daily(hero_id, match_date);

CREATE INDEX IF NOT EXISTS idx_global_hero_stats_daily_date
ON global_hero_stats_daily(match_date);

CREATE INDEX IF NOT EXISTS idx_global_hero_stats_daily_hero
ON global_hero_stats_daily(hero_id);

CREATE INDEX IF NOT EXISTS idx_global_hero_stats_daily_cumulative
ON global_hero_stats_daily(cumulative_games);

-- ============================================
-- RPC FUNCTION FOR HERO STATS OVER TIME
-- ============================================

CREATE OR REPLACE FUNCTION get_global_hero_stats_over_time(
  p_hero_ids INTEGER[] DEFAULT NULL,
  p_min_games INTEGER DEFAULT 3,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH hero_data AS (
    SELECT
      ghsd.hero_id,
      ghsd.hero_name,
      json_agg(
        json_build_object(
          'date', ghsd.match_date,
          'gamesPlayedTotal', ghsd.cumulative_games,
          'winsTotal', ghsd.cumulative_wins,
          'winRate', ghsd.cumulative_win_rate,
          'gamesPlayedOnDate', ghsd.games_played
        ) ORDER BY ghsd.match_date
      ) as data_points,
      MAX(ghsd.cumulative_games) as total_games,
      (SELECT cumulative_win_rate FROM global_hero_stats_daily
       WHERE hero_id = ghsd.hero_id
       ORDER BY match_date DESC LIMIT 1) as current_win_rate
    FROM global_hero_stats_daily ghsd
    WHERE (p_hero_ids IS NULL OR ghsd.hero_id = ANY(p_hero_ids))
      AND ghsd.cumulative_games >= p_min_games  -- Filter data points by min games
      AND (p_start_date IS NULL OR ghsd.match_date >= p_start_date)
      AND (p_end_date IS NULL OR ghsd.match_date <= p_end_date)
    GROUP BY ghsd.hero_id, ghsd.hero_name
  )
  SELECT json_build_object(
    'heroes', COALESCE((
      SELECT json_agg(
        json_build_object(
          'heroId', hero_id,
          'heroName', hero_name,
          'totalGames', total_games,
          'currentWinRate', current_win_rate,
          'dataPoints', data_points
        ) ORDER BY total_games DESC
      )
      FROM hero_data
    ), '[]'::json),
    'dateRange', (
      SELECT json_build_object(
        'firstMatch', MIN(match_date)::TEXT,
        'lastMatch', MAX(match_date)::TEXT
      )
      FROM global_hero_stats_daily
    )
  )
  INTO result;

  RETURN COALESCE(result, '{"heroes":[],"dateRange":null}'::json);
END;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant execute to both authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_global_hero_stats_over_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_hero_stats_over_time TO anon;

-- ============================================
-- UPDATE REFRESH FUNCTION
-- ============================================

-- Update the refresh function to include the new view
CREATE OR REPLACE FUNCTION refresh_global_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_hero_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_hero_relationships;
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_hero_stats_daily;
END;
$$;

-- ============================================
-- INITIAL REFRESH
-- ============================================

-- Refresh the view with initial data
REFRESH MATERIALIZED VIEW global_hero_stats_daily;
