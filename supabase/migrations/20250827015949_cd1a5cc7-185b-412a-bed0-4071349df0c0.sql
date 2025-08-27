-- Enable pg_cron and pg_net extensions for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily ETF data updates at 6 AM UTC
SELECT cron.schedule(
  'daily-etf-data-update',
  '0 6 * * *', -- Every day at 6 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/daily-etf-updater-yahoo',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg3MTg2NSwiZXhwIjoyMDcwNDQ3ODY1fQ.FKGwuFE1M4HHHOlMvJdaLCfDOl8GRpZGVrvUe2iiqPQ"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as yahoo_update_id;
  $$
);

-- Schedule dividend updates at 6:30 AM UTC (after ETF data)
SELECT cron.schedule(
  'daily-dividend-update',
  '30 6 * * *', -- Every day at 6:30 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/dividend-updater',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg3MTg2NSwiZXhwIjoyMDcwNDQ3ODY1fQ.FKGwuFE1M4HHHOlMvJdaLCfDOl8GRpZGVrvUe2iiqPQ"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as dividend_update_id;
  $$
);

-- Schedule DRIP calculations at 7 AM UTC (after dividends)
SELECT cron.schedule(
  'daily-drip-calculation',
  '0 7 * * *', -- Every day at 7 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/daily-drip-calculator',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg3MTg2NSwiZXhwIjoyMDcwNDQ3ODY1fQ.FKGwuFE1M4HHHOlMvJdaLCfDOl8GRpZGVrvUe2iiqPQ"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as drip_update_id;
  $$
);

-- Schedule historical price updates at 7:30 AM UTC
SELECT cron.schedule(
  'daily-historical-prices',
  '30 7 * * *', -- Every day at 7:30 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/update-historical-prices-daily',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg3MTg2NSwiZXhwIjoyMDcwNDQ3ODY1fQ.FKGwuFE1M4HHHOlMvJdaLCfDOl8GRpZGVrvUe2iiqPQ"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as historical_update_id;
  $$
);