-- Make etf_id nullable since we're importing based on ticker
ALTER TABLE public.dividends ALTER COLUMN etf_id DROP NOT NULL;