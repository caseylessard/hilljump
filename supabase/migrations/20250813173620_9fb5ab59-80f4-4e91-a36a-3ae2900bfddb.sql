-- Enable pg_cron and pg_net extensions for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily ETF data update at 8:30 PM (20:30) every day
SELECT cron.schedule(
  'daily-etf-data-update',
  '30 20 * * *', -- 8:30 PM daily
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/daily-etf-updater',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg3MTg2NSwiZXhwIjoyMDcwNDQ3ODY1fQ.4jjD2-gMdmMfhJEQNxQVImlbvHKshQiQMo1mWJ7FaWg"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to track daily update runs
CREATE TABLE IF NOT EXISTS daily_update_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date date DEFAULT CURRENT_DATE,
  start_time timestamp with time zone DEFAULT now(),
  end_time timestamp with time zone,
  status text DEFAULT 'running',
  total_etfs integer,
  updated_etfs integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the logs table
ALTER TABLE daily_update_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/update logs
CREATE POLICY "Service can manage update logs" ON daily_update_logs
FOR ALL USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_update_logs_run_date ON daily_update_logs(run_date);
CREATE INDEX IF NOT EXISTS idx_daily_update_logs_status ON daily_update_logs(status);