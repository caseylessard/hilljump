-- Add new columns to match the updated ticker data structure
ALTER TABLE public.etfs 
ADD COLUMN IF NOT EXISTS provider text,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS underlying text,
ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;