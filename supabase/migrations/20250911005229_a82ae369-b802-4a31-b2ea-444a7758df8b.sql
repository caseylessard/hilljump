-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests 
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule hourly DRIP cache updates
SELECT cron.schedule(
  'hourly-drip-update',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/hourly-drip-updater',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Schedule hourly score updates (offset by 30 minutes to avoid conflicts)
SELECT cron.schedule(
  'hourly-score-update',
  '30 * * * *', -- Every hour at minute 30
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/hourly-score-updater',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Create a cron job log table to track executions
CREATE TABLE IF NOT EXISTS cron_execution_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'success',
  response JSONB,
  error_message TEXT
);

-- Enable RLS on the log table
ALTER TABLE cron_execution_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage cron logs
CREATE POLICY "Service can manage cron logs" ON cron_execution_log
  FOR ALL USING (true) WITH CHECK (true);

-- Allow admins to view cron logs
CREATE POLICY "Admins can view cron logs" ON cron_execution_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));