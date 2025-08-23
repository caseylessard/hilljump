-- Add remaining columns to match the complete ticker data structure
ALTER TABLE public.etfs 
ADD COLUMN IF NOT EXISTS fund text,
ADD COLUMN IF NOT EXISTS strategy text,
ADD COLUMN IF NOT EXISTS industry text;

-- Update the name column to use fund instead (since fund seems to be the proper ETF name)
-- We'll keep both columns for compatibility