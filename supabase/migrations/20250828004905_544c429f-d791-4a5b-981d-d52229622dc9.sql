-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily ETF price updates at 2 AM UTC
SELECT cron.schedule(
  'daily-etf-price-update',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/daily-etf-updater-yahoo',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);