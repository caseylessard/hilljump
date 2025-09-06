-- Enable pg_cron extension for scheduling automated tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to run dividend updates daily at 6 AM EST
SELECT cron.schedule(
  'daily-dividend-update',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/fetch-latest-dividends',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);