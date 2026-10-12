-- Migration 012: cloud_matches.victory_type
--
-- The app has uploaded cloud_matches.victory_type since victory types were added,
-- and migration 011 reads it, but no migration ever created the column. This makes
-- the schema reproducible. Idempotent: safe on databases that already have it.
-- Older app versions keep working: the column is nullable and they either send
-- a valid value, NULL, or nothing.

ALTER TABLE cloud_matches
  ADD COLUMN IF NOT EXISTS victory_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cloud_matches_victory_type_check'
      AND conrelid = 'cloud_matches'::regclass
  ) THEN
    -- NOT VALID: enforce for new and updated rows without re-checking existing rows.
    ALTER TABLE cloud_matches
      ADD CONSTRAINT cloud_matches_victory_type_check
      CHECK (victory_type IS NULL OR victory_type IN ('throne', 'wave', 'kills'))
      NOT VALID;
  END IF;
END $$;

-- Anonymised share links dropped victory_type from match objects (the
-- non-anonymised branch already returns it through row_to_json).
-- Body copied from 007_enhanced_share_links.sql with one added line.
CREATE OR REPLACE FUNCTION get_shared_data(p_share_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link share_links;
  v_result JSON;
BEGIN
  -- Find the share link (active only)
  SELECT * INTO v_link
  FROM share_links
  WHERE share_token = p_share_token
    AND is_active = true;

  -- Return specific error if link not found
  IF v_link IS NULL THEN
    RETURN json_build_object(
      'error', 'Share link not found or inactive',
      'error_code', 'LINK_NOT_FOUND'
    );
  END IF;

  -- Check if link has expired
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    -- Mark the link as inactive since it's expired
    UPDATE share_links
    SET is_active = false
    WHERE id = v_link.id;

    RETURN json_build_object(
      'error', 'This share link has expired',
      'error_code', 'LINK_EXPIRED',
      'expired_at', v_link.expires_at
    );
  END IF;

  -- Update view count and last viewed timestamp
  UPDATE share_links
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE id = v_link.id;

  -- Build the result with optional anonymization
  IF v_link.is_anonymized THEN
    -- Anonymized version: replace player names with "Player 1", "Player 2", etc.
    SELECT json_build_object(
      'owner_id', v_link.owner_id,
      'display_name', COALESCE(p.display_name, p.username),
      'is_anonymized', true,
      'expires_at', v_link.expires_at,
      'players', COALESCE(
        (SELECT json_agg(
          json_build_object(
            'id', sub.id,
            'owner_id', sub.owner_id,
            'local_id', sub.local_id,
            'name', 'Player ' || sub.rn,
            'total_games', sub.total_games,
            'wins', sub.wins,
            'losses', sub.losses,
            'elo', sub.elo,
            'mu', sub.mu,
            'sigma', sub.sigma,
            'ordinal', sub.ordinal,
            'last_played', sub.last_played,
            'date_created', sub.date_created,
            'device_id', NULL,
            'level', sub.level
          ) ORDER BY sub.rn
        )
        FROM (
          SELECT *, ROW_NUMBER() OVER (ORDER BY date_created) as rn
          FROM cloud_players
          WHERE owner_id = v_link.owner_id
        ) sub),
        '[]'::json
      ),
      'matches', COALESCE(
        (SELECT json_agg(
          json_build_object(
            'id', cm.id,
            'owner_id', cm.owner_id,
            'date', cm.date,
            'winning_team', cm.winning_team,
            'game_length', cm.game_length,
            'double_lanes', cm.double_lanes,
            'titan_players', cm.titan_players,
            'atlantean_players', cm.atlantean_players,
            'victory_type', cm.victory_type,
            'device_id', NULL
          )
        )
        FROM cloud_matches cm
        WHERE cm.owner_id = v_link.owner_id),
        '[]'::json
      ),
      'match_players', COALESCE(
        (SELECT json_agg(
          json_build_object(
            'id', cmp.id,
            'owner_id', cmp.owner_id,
            'match_id', cmp.match_id,
            'player_id', cmp.player_id,
            'team', cmp.team,
            'hero_id', cmp.hero_id,
            'hero_name', cmp.hero_name,
            'hero_roles', cmp.hero_roles,
            'kills', cmp.kills,
            'deaths', cmp.deaths,
            'assists', cmp.assists,
            'gold_earned', cmp.gold_earned,
            'minion_kills', cmp.minion_kills,
            'level', cmp.level,
            'device_id', NULL
          )
        )
        FROM cloud_match_players cmp
        WHERE cmp.owner_id = v_link.owner_id),
        '[]'::json
      ),
      'player_name_mapping', COALESCE(
        (SELECT json_object_agg(sub.local_id, 'Player ' || sub.rn)
        FROM (
          SELECT local_id, ROW_NUMBER() OVER (ORDER BY date_created) as rn
          FROM cloud_players
          WHERE owner_id = v_link.owner_id
        ) sub),
        '{}'::json
      )
    ) INTO v_result
    FROM profiles p
    WHERE p.id = v_link.owner_id;
  ELSE
    -- Non-anonymized version: return full data
    SELECT json_build_object(
      'owner_id', v_link.owner_id,
      'display_name', COALESCE(p.display_name, p.username),
      'is_anonymized', false,
      'expires_at', v_link.expires_at,
      'players', COALESCE(
        (SELECT json_agg(row_to_json(cp))
         FROM cloud_players cp
         WHERE cp.owner_id = v_link.owner_id),
        '[]'::json
      ),
      'matches', COALESCE(
        (SELECT json_agg(row_to_json(cm))
         FROM cloud_matches cm
         WHERE cm.owner_id = v_link.owner_id),
        '[]'::json
      ),
      'match_players', COALESCE(
        (SELECT json_agg(row_to_json(cmp))
         FROM cloud_match_players cmp
         WHERE cmp.owner_id = v_link.owner_id),
        '[]'::json
      )
    ) INTO v_result
    FROM profiles p
    WHERE p.id = v_link.owner_id;
  END IF;

  RETURN v_result;
END;
$$;
