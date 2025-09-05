-- Create crypto_universe table for filtered cryptocurrency data
CREATE TABLE IF NOT EXISTS public.crypto_universe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  rank_order INTEGER NOT NULL,
  price NUMERIC,
  change_24h_pct NUMERIC,
  atr_pct NUMERIC,
  volume_usd NUMERIC,
  momentum_score NUMERIC,
  filtered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  filter_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(filter_date, rank_order, symbol)
);

-- Enable RLS
ALTER TABLE public.crypto_universe ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Crypto universe is publicly viewable" 
ON public.crypto_universe 
FOR SELECT 
USING (true);

CREATE POLICY "Service can manage crypto universe data" 
ON public.crypto_universe 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_crypto_universe_filter_date ON public.crypto_universe(filter_date);
CREATE INDEX IF NOT EXISTS idx_crypto_universe_rank ON public.crypto_universe(filter_date, rank_order);
CREATE INDEX IF NOT EXISTS idx_crypto_universe_score ON public.crypto_universe(filter_date, momentum_score DESC);