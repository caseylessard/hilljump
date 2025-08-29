-- Drop the existing drip_cache table
DROP TABLE IF EXISTS public.drip_cache;

-- Create separate DRIP cache tables for US and Canadian users
CREATE TABLE public.drip_cache_us (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_4w JSONB,
  period_13w JSONB,
  period_26w JSONB,
  period_52w JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticker)
);

CREATE TABLE public.drip_cache_ca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_4w JSONB,
  period_13w JSONB,
  period_26w JSONB,
  period_52w JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticker)
);

-- Enable RLS on both tables
ALTER TABLE public.drip_cache_us ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_cache_ca ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "DRIP cache US is publicly viewable" 
ON public.drip_cache_us 
FOR SELECT 
USING (true);

CREATE POLICY "DRIP cache CA is publicly viewable" 
ON public.drip_cache_ca 
FOR SELECT 
USING (true);

-- Create policies for service management
CREATE POLICY "Service can manage DRIP cache US" 
ON public.drip_cache_us 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Service can manage DRIP cache CA" 
ON public.drip_cache_ca 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX idx_drip_cache_us_ticker ON public.drip_cache_us(ticker);
CREATE INDEX idx_drip_cache_ca_ticker ON public.drip_cache_ca(ticker);
CREATE INDEX idx_drip_cache_us_updated_at ON public.drip_cache_us(updated_at);
CREATE INDEX idx_drip_cache_ca_updated_at ON public.drip_cache_ca(updated_at);