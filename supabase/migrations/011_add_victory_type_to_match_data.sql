-- Add victory_type to hero_skill_match_data view so client-side
-- g-formula computation can produce victory profiles from global data.

DROP VIEW IF EXISTS hero_skill_match_data;
CREATE VIEW hero_skill_match_data AS
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
    victory_type,
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
    dm.victory_type,
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
  victory_type,
  hero_id,
  hero_name,
  team,
  player_mu
FROM match_with_players;
