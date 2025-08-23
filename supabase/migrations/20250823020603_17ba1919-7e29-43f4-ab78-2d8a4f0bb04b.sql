-- Add cadence column to dividends table to match the import data structure
ALTER TABLE public.dividends 
ADD COLUMN IF NOT EXISTS cadence text;

-- Update cash_currency column name to match import data (currency)
-- We'll keep both for compatibility but make currency the primary field