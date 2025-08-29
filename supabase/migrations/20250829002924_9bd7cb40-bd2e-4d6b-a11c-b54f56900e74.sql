-- Add tax preference columns to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN tax_country text NOT NULL DEFAULT 'US',
ADD COLUMN tax_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN tax_rate numeric NOT NULL DEFAULT 15.0;