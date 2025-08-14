-- Create table to track dividend update logs
CREATE TABLE public.dividend_update_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running',
  total_etfs INTEGER,
  updated_etfs INTEGER,
  inserted_events INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dividend_update_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for public viewing
CREATE POLICY "Dividend update logs are publicly viewable" 
ON public.dividend_update_logs 
FOR SELECT 
USING (true);

-- Add last_dividend_update column to etfs table
ALTER TABLE public.etfs 
ADD COLUMN last_dividend_update TIMESTAMP WITH TIME ZONE;