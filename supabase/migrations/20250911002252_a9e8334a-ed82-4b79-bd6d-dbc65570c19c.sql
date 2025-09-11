-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily ETF data update at 8pm Eastern (1am UTC during standard time)
-- This runs the comprehensive daily update that includes prices, dividends, DRIP, and historical data
SELECT cron.schedule(
  'daily-etf-data-update-8pm-est',
  '0 1 * * *', -- 1am UTC = 8pm EST (9pm EDT)
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/run-daily-updates',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{"scheduled": true, "trigger": "daily-8pm-est"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule price-only updates every 4 hours starting from midnight EST
-- These are lighter updates that just refresh current prices and basic metrics
SELECT cron.schedule(
  'price-update-every-4h',
  '0 5,9,13,17,21 * * *', -- 5am, 9am, 1pm, 5pm, 9pm UTC (midnight, 4am, 8am, 12pm, 4pm EST)
  $$
  SELECT
    net.http_post(
        url:='https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/daily-etf-updater-yahoo',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
        body:='{"scheduled": true, "trigger": "4hourly-price-update"}'::jsonb
    ) as request_id;
  $$
);

-- Create a monitoring table to track cron job execution
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL,
  executed_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'running',
  response jsonb,
  error_message text
);

-- Enable RLS on cron job logs table
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all cron job logs
CREATE POLICY "Admins can view cron job logs" 
ON public.cron_job_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);