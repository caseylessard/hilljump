-- Create table for historical prices
CREATE TABLE public.historical_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  open_price NUMERIC,
  high_price NUMERIC,
  low_price NUMERIC,
  close_price NUMERIC NOT NULL,
  volume BIGINT,
  adjusted_close NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicate entries
  UNIQUE(ticker, date)
);

-- Enable RLS
ALTER TABLE public.historical_prices ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Historical prices are publicly viewable" 
ON public.historical_prices 
FOR SELECT 
USING (true);

-- Create policy for service to insert/update prices
CREATE POLICY "Service can manage historical prices" 
ON public.historical_prices 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_historical_prices_ticker_date ON public.historical_prices(ticker, date DESC);
CREATE INDEX idx_historical_prices_date ON public.historical_prices(date DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_historical_prices_updated_at
BEFORE UPDATE ON public.historical_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();