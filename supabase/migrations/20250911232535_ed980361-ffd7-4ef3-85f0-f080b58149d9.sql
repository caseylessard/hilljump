-- Fix price update timing to avoid conflicts at market close
-- Remove existing price update job that runs exactly on the hour
SELECT cron.unschedule('price-update-every-4h');

-- Schedule price updates at :01 minutes past each target hour to avoid conflicts
-- This runs at 5:01am, 9:01am, 1:01pm, 5:01pm, 9:01pm UTC
-- Which is 12:01am, 4:01am, 8:01am, 12:01pm, 4:01pm EST
SELECT cron.schedule(
  'price-update-every-4h-offset',
  '1 5,9,13,17,21 * * *', -- 1 minute past each hour
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/daily-etf-updater-yahoo',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{"scheduled": true, "trigger": "4hourly-price-update-offset"}'::jsonb
    ) as request_id;
  $$
);

-- Also update the daily comprehensive update to avoid conflicts
SELECT cron.unschedule('daily-etf-data-update-8pm-est');

-- Schedule daily update at 1:01am UTC (8:01pm EST) instead of exactly 1:00am
SELECT cron.schedule(
  'daily-etf-data-update-8pm-est-offset',
  '1 1 * * *', -- 1:01am UTC = 8:01pm EST
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/run-daily-updates',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{"scheduled": true, "trigger": "daily-8pm-est-offset"}'::jsonb
    ) as request_id;
  $$
);