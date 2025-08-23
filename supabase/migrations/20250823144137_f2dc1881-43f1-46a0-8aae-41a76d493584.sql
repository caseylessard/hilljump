-- Remove redundant provider column since it contains identical data to manager
ALTER TABLE public.etfs DROP COLUMN IF EXISTS provider;