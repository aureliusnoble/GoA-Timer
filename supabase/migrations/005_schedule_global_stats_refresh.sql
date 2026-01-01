-- Migration: Schedule automatic refresh of global hero stats
-- This sets up a pg_cron job to refresh materialized views every hour

-- Enable pg_cron extension (requires superuser, enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user (required for scheduling)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove any existing job with the same name (idempotent)
-- Using DO block to handle case where job doesn't exist
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-global-stats');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END;
$$;

-- Schedule refresh every hour at minute 0
-- This refreshes all three materialized views:
--   - global_hero_stats
--   - global_hero_relationships
--   - global_hero_stats_daily
SELECT cron.schedule(
  'refresh-global-stats',    -- job name
  '0 * * * *',               -- cron expression: every hour at minute 0
  $$SELECT refresh_global_stats()$$
);

-- Also run an initial refresh immediately after migration
SELECT refresh_global_stats();

-- Add a comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used to refresh global hero stats hourly';
