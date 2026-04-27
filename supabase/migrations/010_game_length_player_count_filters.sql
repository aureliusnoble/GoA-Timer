-- Migration: Game Length and Player Count Filters for Global Stats
-- Adds parameterized RPC functions that filter by game_length and player_count
-- When no filters are applied, delegates to existing materialized views (fast path)

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cloud_matches_game_length
ON cloud_matches(game_length);

CREATE INDEX IF NOT EXISTS idx_cloud_matches_player_count
ON cloud_matches((titan_players + atlantean_players));

-- ============================================
-- FILTERED HERO STATS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_global_hero_stats_filtered(
  min_games_hero INTEGER DEFAULT 1,
  min_games_relationship INTEGER DEFAULT 3,
  p_game_length TEXT DEFAULT NULL,
  p_player_count INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Fast path: no filters, use materialized views
  IF p_game_length IS NULL AND p_player_count IS NULL THEN
    RETURN get_global_hero_stats_full(min_games_hero, min_games_relationship);
  END IF;

  -- Filtered path: query raw tables with deduplication
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
      titan_players,
      atlantean_players
    FROM cloud_matches
    WHERE (p_game_length IS NULL OR game_length = p_game_length)
      AND (p_player_count IS NULL OR (titan_players + atlantean_players) = p_player_count)
    ORDER BY
      DATE_TRUNC('minute', date),
      winning_team,
      game_length,
      titan_players,
      atlantean_players,
      synced_at DESC
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
  ),
  hero_stats AS (
    SELECT
      hero_id,
      hero_name,
      COUNT(*)::INTEGER AS total_games,
      SUM(CASE WHEN team = winning_team THEN 1 ELSE 0 END)::INTEGER AS wins,
      SUM(CASE WHEN team != winning_team THEN 1 ELSE 0 END)::INTEGER AS losses,
      ROUND(
        100.0 * SUM(CASE WHEN team = winning_team THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
        2
      )::NUMERIC AS win_rate
    FROM hero_match_data
    GROUP BY hero_id, hero_name
  ),
  -- Teammate relationships
  teammate_pairs AS (
    SELECT
      h1.hero_id,
      h2.hero_id AS related_hero_id,
      h2.hero_name AS related_hero_name,
      CASE WHEN h1.team = h1.winning_team THEN 1 ELSE 0 END AS won
    FROM hero_match_data h1
    INNER JOIN hero_match_data h2
      ON h1.match_id = h2.match_id
      AND h1.team = h2.team
      AND h1.hero_id != h2.hero_id
  ),
  teammate_stats AS (
    SELECT
      hero_id,
      related_hero_id,
      related_hero_name,
      COUNT(*)::INTEGER AS games_played,
      SUM(won)::INTEGER AS wins,
      ROUND(100.0 * SUM(won) / NULLIF(COUNT(*), 0), 2)::NUMERIC AS win_rate
    FROM teammate_pairs
    GROUP BY hero_id, related_hero_id, related_hero_name
  ),
  -- Opponent relationships
  opponent_pairs AS (
    SELECT
      h1.hero_id,
      h2.hero_id AS related_hero_id,
      h2.hero_name AS related_hero_name,
      CASE WHEN h1.team = h1.winning_team THEN 1 ELSE 0 END AS won
    FROM hero_match_data h1
    INNER JOIN hero_match_data h2
      ON h1.match_id = h2.match_id
      AND h1.team != h2.team
  ),
  opponent_stats AS (
    SELECT
      hero_id,
      related_hero_id,
      related_hero_name,
      COUNT(*)::INTEGER AS games_played,
      SUM(won)::INTEGER AS wins,
      ROUND(100.0 * SUM(won) / NULLIF(COUNT(*), 0), 2)::NUMERIC AS win_rate
    FROM opponent_pairs
    GROUP BY hero_id, related_hero_id, related_hero_name
  )
  SELECT json_agg(hero_data ORDER BY hero_data->>'total_games' DESC)
  INTO result
  FROM (
    SELECT
      json_build_object(
        'hero_id', hs.hero_id,
        'hero_name', hs.hero_name,
        'total_games', hs.total_games,
        'wins', hs.wins,
        'losses', hs.losses,
        'win_rate', hs.win_rate,
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
            FROM teammate_stats ts
            WHERE ts.hero_id = hs.hero_id
              AND ts.games_played >= min_games_relationship
            ORDER BY ts.win_rate DESC
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
            FROM opponent_stats os
            WHERE os.hero_id = hs.hero_id
              AND os.games_played >= min_games_relationship
            ORDER BY os.win_rate DESC
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
            FROM opponent_stats os
            WHERE os.hero_id = hs.hero_id
              AND os.games_played >= min_games_relationship
            ORDER BY os.win_rate ASC
            LIMIT 3
          ) w
        )
      ) AS hero_data
    FROM hero_stats hs
    WHERE hs.total_games >= min_games_hero
  ) subq;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================
-- FILTERED HERO STATS OVER TIME RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_global_hero_stats_over_time_filtered(
  p_hero_ids INTEGER[] DEFAULT NULL,
  p_min_games INTEGER DEFAULT 3,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_game_length TEXT DEFAULT NULL,
  p_player_count INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Fast path: no game filters, use existing function
  IF p_game_length IS NULL AND p_player_count IS NULL THEN
    RETURN get_global_hero_stats_over_time(p_hero_ids, p_min_games, p_start_date, p_end_date);
  END IF;

  -- Filtered path: query raw tables
  WITH deduplicated_matches AS (
    SELECT DISTINCT ON (
      DATE_TRUNC('minute', date),
      winning_team,
      game_length,
      titan_players,
      atlantean_players
    )
      id AS match_id,
      DATE(date) AS match_date,
      winning_team
    FROM cloud_matches
    WHERE (p_game_length IS NULL OR game_length = p_game_length)
      AND (p_player_count IS NULL OR (titan_players + atlantean_players) = p_player_count)
    ORDER BY
      DATE_TRUNC('minute', date),
      winning_team,
      game_length,
      titan_players,
      atlantean_players,
      synced_at DESC
  ),
  hero_daily_stats AS (
    SELECT
      cmp.hero_id,
      cmp.hero_name,
      dm.match_date,
      COUNT(*)::INTEGER AS games_played,
      SUM(CASE WHEN cmp.team = dm.winning_team THEN 1 ELSE 0 END)::INTEGER AS wins
    FROM cloud_match_players cmp
    INNER JOIN deduplicated_matches dm ON cmp.match_id = dm.match_id
    GROUP BY cmp.hero_id, cmp.hero_name, dm.match_date
  ),
  hero_cumulative AS (
    SELECT
      hero_id,
      hero_name,
      match_date,
      games_played,
      wins,
      SUM(games_played) OVER (
        PARTITION BY hero_id ORDER BY match_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )::INTEGER AS cumulative_games,
      SUM(wins) OVER (
        PARTITION BY hero_id ORDER BY match_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )::INTEGER AS cumulative_wins
    FROM hero_daily_stats
  ),
  hero_data AS (
    SELECT
      hc.hero_id,
      hc.hero_name,
      json_agg(
        json_build_object(
          'date', hc.match_date,
          'gamesPlayedTotal', hc.cumulative_games,
          'winsTotal', hc.cumulative_wins,
          'winRate', ROUND(100.0 * hc.cumulative_wins / NULLIF(hc.cumulative_games, 0), 2),
          'gamesPlayedOnDate', hc.games_played
        ) ORDER BY hc.match_date
      ) AS data_points,
      MAX(hc.cumulative_games) AS total_games,
      (SELECT ROUND(100.0 * hc2.cumulative_wins / NULLIF(hc2.cumulative_games, 0), 2)
       FROM hero_cumulative hc2
       WHERE hc2.hero_id = hc.hero_id
       ORDER BY hc2.match_date DESC LIMIT 1) AS current_win_rate
    FROM hero_cumulative hc
    WHERE (p_hero_ids IS NULL OR hc.hero_id = ANY(p_hero_ids))
      AND hc.cumulative_games >= p_min_games
      AND (p_start_date IS NULL OR hc.match_date >= p_start_date)
      AND (p_end_date IS NULL OR hc.match_date <= p_end_date)
    GROUP BY hc.hero_id, hc.hero_name
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
      FROM deduplicated_matches
    )
  )
  INTO result;

  RETURN COALESCE(result, '{"heroes":[],"dateRange":null}'::json);
END;
$$;

-- ============================================
-- FILTERED HERO RELATIONSHIPS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_global_hero_relationships_filtered(
  p_hero_ids INTEGER[],
  p_min_games INTEGER DEFAULT 1,
  p_game_length TEXT DEFAULT NULL,
  p_player_count INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Fast path: no game filters, query materialized view
  IF p_game_length IS NULL AND p_player_count IS NULL THEN
    SELECT json_agg(
      json_build_object(
        'hero_id', ghr.hero_id,
        'related_hero_id', ghr.related_hero_id,
        'relationship_type', ghr.relationship_type,
        'games_played', ghr.games_played,
        'wins', ghr.wins
      )
    )
    INTO result
    FROM global_hero_relationships ghr
    WHERE ghr.hero_id = ANY(p_hero_ids)
      AND ghr.related_hero_id = ANY(p_hero_ids)
      AND ghr.games_played >= p_min_games;

    RETURN COALESCE(result, '[]'::json);
  END IF;

  -- Filtered path
  WITH deduplicated_matches AS (
    SELECT DISTINCT ON (
      DATE_TRUNC('minute', date),
      winning_team,
      game_length,
      titan_players,
      atlantean_players
    )
      id AS match_id,
      winning_team
    FROM cloud_matches
    WHERE (p_game_length IS NULL OR game_length = p_game_length)
      AND (p_player_count IS NULL OR (titan_players + atlantean_players) = p_player_count)
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
    WHERE cmp.hero_id = ANY(p_hero_ids)
  ),
  teammate_pairs AS (
    SELECT
      h1.hero_id,
      h2.hero_id AS related_hero_id,
      'teammate' AS relationship_type,
      CASE WHEN h1.team = h1.winning_team THEN 1 ELSE 0 END AS won
    FROM match_heroes h1
    INNER JOIN cloud_match_players h2
      ON h1.match_id = h2.match_id
      AND h1.team = h2.team
      AND h1.hero_id != h2.hero_id
    WHERE h2.hero_id = ANY(p_hero_ids)
  ),
  opponent_pairs AS (
    SELECT
      h1.hero_id,
      h2.hero_id AS related_hero_id,
      'opponent' AS relationship_type,
      CASE WHEN h1.team = h1.winning_team THEN 1 ELSE 0 END AS won
    FROM match_heroes h1
    INNER JOIN cloud_match_players h2
      ON h1.match_id = h2.match_id
      AND h1.team != h2.team
    WHERE h2.hero_id = ANY(p_hero_ids)
  ),
  combined AS (
    SELECT * FROM teammate_pairs
    UNION ALL
    SELECT * FROM opponent_pairs
  )
  SELECT json_agg(
    json_build_object(
      'hero_id', hero_id,
      'related_hero_id', related_hero_id,
      'relationship_type', relationship_type,
      'games_played', COUNT(*)::INTEGER,
      'wins', SUM(won)::INTEGER
    )
  )
  INTO result
  FROM combined
  GROUP BY hero_id, related_hero_id, relationship_type
  HAVING COUNT(*) >= p_min_games;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================
-- PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_global_hero_stats_filtered TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_hero_stats_filtered TO anon;
GRANT EXECUTE ON FUNCTION get_global_hero_stats_over_time_filtered TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_hero_stats_over_time_filtered TO anon;
GRANT EXECUTE ON FUNCTION get_global_hero_relationships_filtered TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_hero_relationships_filtered TO anon;
