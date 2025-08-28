-- Remove the resource-intensive smart updater
SELECT cron.unschedule('smart-etf-price-update');

-- Schedule the free-tier optimized updater
SELECT cron.schedule(
  'free-tier-price-update',
  '0 2 * * *',  -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/free-tier-price-updater',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);