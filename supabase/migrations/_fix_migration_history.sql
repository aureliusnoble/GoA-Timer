-- ONE-TIME FIX: Register previously-applied migrations in the history table.
-- Run this in the Supabase SQL Editor BEFORE running `supabase db push`.
-- These migrations were applied manually and are already in the database,
-- but the CLI migration history table doesn't know about them.

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('002', 'deleted_matches'),
  ('003', 'global_hero_stats'),
  ('004', 'global_hero_stats_daily'),
  ('005', 'schedule_global_stats_refresh'),
  ('006', 'share_links'),
  ('007', 'enhanced_share_links')
ON CONFLICT (version) DO NOTHING;
