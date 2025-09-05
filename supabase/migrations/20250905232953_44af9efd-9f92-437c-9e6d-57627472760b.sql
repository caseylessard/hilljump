-- Create equity_universe table for filtered small-cap stocks
CREATE TABLE IF NOT EXISTS public.equity_universe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  rank_order INTEGER NOT NULL,
  price NUMERIC,
  float_shares BIGINT,
  avg_dollar_volume NUMERIC,
  exchange TEXT,
  market_cap BIGINT,
  filtered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  filter_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(filter_date, rank_order, ticker)
);

-- Enable RLS
ALTER TABLE public.equity_universe ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Universe is publicly viewable" 
ON public.equity_universe 
FOR SELECT 
USING (true);

CREATE POLICY "Service can manage universe data" 
ON public.equity_universe 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_equity_universe_filter_date ON public.equity_universe(filter_date);
CREATE INDEX IF NOT EXISTS idx_equity_universe_rank ON public.equity_universe(filter_date, rank_order);