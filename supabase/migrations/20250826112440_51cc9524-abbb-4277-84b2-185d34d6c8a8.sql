-- Create a dedicated price cache table for better price management
CREATE TABLE IF NOT EXISTS public.price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  price NUMERIC NOT NULL,
  source TEXT NOT NULL, -- 'polygon', 'yahoo', 'stooq', 'database'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticker)
);

-- Enable RLS
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for price cache
CREATE POLICY "Price cache is publicly viewable" 
ON public.price_cache 
FOR SELECT 
USING (true);

CREATE POLICY "Service can manage price cache" 
ON public.price_cache 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create updated_at trigger for price_cache
CREATE TRIGGER update_price_cache_updated_at
BEFORE UPDATE ON public.price_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();