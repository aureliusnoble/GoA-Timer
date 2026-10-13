-- Optional per-round stat log for each match player, recorded during a live
-- game: a JSON array of {round, kills?, deaths?, assists?, goldEarned?,
-- minionKills?, level?}. Nullable: matches recorded without a round log keep
-- NULL. Idempotent. Older app clients never send this column, so their
-- upserts leave it untouched.
ALTER TABLE cloud_match_players
  ADD COLUMN IF NOT EXISTS round_stats JSONB;
