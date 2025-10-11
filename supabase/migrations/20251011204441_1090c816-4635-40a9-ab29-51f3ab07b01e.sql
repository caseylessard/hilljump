-- Create options cache table for storing fetched options data
CREATE TABLE IF NOT EXISTS public.options_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  ticker TEXT NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_options_cache_key ON public.options_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_options_cache_ticker ON public.options_cache(ticker);
CREATE INDEX IF NOT EXISTS idx_options_cache_expires ON public.options_cache(expires_at);

-- Enable RLS
ALTER TABLE public.options_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (data is market data, not user-specific)
CREATE POLICY "Public read access to options cache"
  ON public.options_cache
  FOR SELECT
  USING (true);

-- Only service role can write/update cache
CREATE POLICY "Service role can manage cache"
  ON public.options_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.clean_expired_options_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.options_cache
  WHERE expires_at < now();
END;
$$;