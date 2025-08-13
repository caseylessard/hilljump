-- First, modify constraints to allow NULL values for data we want to clean
ALTER TABLE public.etfs 
  ALTER COLUMN total_return_1y DROP NOT NULL,
  ALTER COLUMN yield_ttm DROP NOT NULL,
  ALTER COLUMN avg_volume DROP NOT NULL,
  ALTER COLUMN aum DROP NOT NULL;