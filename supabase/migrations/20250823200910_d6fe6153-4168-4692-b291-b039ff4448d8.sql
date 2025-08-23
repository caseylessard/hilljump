-- Check what triggers exist on the etfs table and remove the problematic one
-- The trigger is trying to update 'updated_at' but the etfs table uses 'price_updated_at'

-- Drop the trigger that's causing the issue
DROP TRIGGER IF EXISTS update_etfs_updated_at ON public.etfs;

-- Add the missing updated_at column if we want to keep the trigger pattern
ALTER TABLE public.etfs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Recreate the trigger to work with the new column
CREATE TRIGGER update_etfs_updated_at
    BEFORE UPDATE ON public.etfs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();