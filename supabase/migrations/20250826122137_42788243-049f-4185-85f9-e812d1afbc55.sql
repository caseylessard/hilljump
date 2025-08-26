-- Create etf_scores table to store calculated scores
CREATE TABLE public.etf_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  composite_score NUMERIC,
  return_score NUMERIC,
  yield_score NUMERIC, 
  risk_score NUMERIC,
  weights JSONB,
  country TEXT DEFAULT 'CA',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.etf_scores ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "ETF scores are publicly viewable" 
ON public.etf_scores 
FOR SELECT 
USING (true);

CREATE POLICY "Service can manage ETF scores" 
ON public.etf_scores 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create unique index on ticker + country for efficient lookups
CREATE UNIQUE INDEX idx_etf_scores_ticker_country ON public.etf_scores(ticker, country);

-- Create trigger for updated_at
CREATE TRIGGER update_etf_scores_updated_at
BEFORE UPDATE ON public.etf_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();