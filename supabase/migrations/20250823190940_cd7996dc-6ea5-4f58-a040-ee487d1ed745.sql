-- Create a daily cron job to update ETF yields from Yahoo Finance
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily yield updates at 6 AM UTC (after markets close)
SELECT cron.schedule(
  'daily-yfinance-yield-update',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/yfinance-yields',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
    body := jsonb_build_object(
      'tickers', (SELECT array_agg(ticker) FROM etfs WHERE active = true),
      'updateDatabase', true
    )
  ) as request_id;
  $$
);