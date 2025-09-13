-- Adjust price update timing to capture proper 4:00pm closing prices
-- Remove existing price update job that runs too early (4:01pm EST)
SELECT cron.unschedule('price-update-every-4h-offset');

-- Schedule price updates with proper timing for market close
-- This runs at 5:15am, 9:15am, 1:15pm, 5:15pm, 9:15pm UTC
-- Which is 12:15am, 4:15am, 8:15am, 12:15pm, 4:15pm EST
-- The 4:15pm EST timing allows proper capture of 4:00pm closing prices
SELECT cron.schedule(
  'price-update-every-4h-market-close',
  '15 5,9,13,17,21 * * *', -- 15 minutes past each hour
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/daily-etf-updater-yahoo',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{"scheduled": true, "trigger": "4hourly-price-update-market-close"}'::jsonb
    ) as request_id;
  $$
);