-- Migration: Schedule hero skill stats computation via pg_net + pg_cron
-- Calls the compute-hero-skill-stats Edge Function hourly after the
-- materialized view refresh completes.

-- Enable pg_net extension (HTTP requests from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if present
DO $$
BEGIN
  PERFORM cron.unschedule('compute-hero-skill-stats');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;

-- Schedule the edge function call every hour at minute 5
-- (5 minutes after the materialized view refresh at minute 0)
SELECT cron.schedule(
  'compute-hero-skill-stats',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/compute-hero-skill-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMENT ON EXTENSION pg_net IS 'Async HTTP requests - used to trigger Edge Functions from pg_cron';
