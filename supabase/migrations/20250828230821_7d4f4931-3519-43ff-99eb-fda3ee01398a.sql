-- Create table for historical ETF rankings to track week-to-week changes
CREATE TABLE public.etf_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  rank_position INTEGER NOT NULL,
  composite_score NUMERIC NOT NULL,
  week_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.etf_rankings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access to ranking data
CREATE POLICY "Rankings are publicly viewable" 
ON public.etf_rankings 
FOR SELECT 
USING (true);

-- Service can manage rankings
CREATE POLICY "Service can manage rankings" 
ON public.etf_rankings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_etf_rankings_ticker_week ON public.etf_rankings(ticker, week_date DESC);
CREATE INDEX idx_etf_rankings_week_rank ON public.etf_rankings(week_date DESC, rank_position);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_etf_rankings_updated_at
BEFORE UPDATE ON public.etf_rankings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();