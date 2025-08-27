-- Remove unused Finnhub column from etfs table
ALTER TABLE public.etfs DROP COLUMN IF EXISTS finnhub_symbol;