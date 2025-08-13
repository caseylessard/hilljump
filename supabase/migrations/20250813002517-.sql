-- Add persistent metadata fields to etfs
ALTER TABLE public.etfs
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS manager text,
  ADD COLUMN IF NOT EXISTS strategy_label text,
  ADD COLUMN IF NOT EXISTS logo_key text;

-- Backfill country from exchange where missing
UPDATE public.etfs
SET country = CASE
  WHEN exchange IS NULL THEN NULL
  WHEN upper(exchange) ~ '(TSX|TSXV|NEO|CSE|TSE)' THEN 'CA'
  ELSE 'US'
END
WHERE country IS NULL;

-- Backfill manager heuristically from name/category where missing
UPDATE public.etfs
SET manager = CASE
  WHEN name IS NULL THEN NULL
  WHEN upper(name) LIKE 'YIELDMAX%' OR upper(coalesce(category,'')) LIKE '%YIELDMAX%'
    THEN 'YieldMax'
  WHEN upper(name) LIKE 'GLOBAL X%'
    THEN 'Global X'
  WHEN upper(name) LIKE 'JPMORGAN%' OR upper(name) LIKE 'J.P. MORGAN%' OR upper(name) LIKE 'JP MORGAN%'
    THEN 'JPMorgan'
  WHEN upper(name) LIKE 'AMPLIFY%'
    THEN 'Amplify'
  WHEN upper(name) LIKE 'ROUNDHILL%'
    THEN 'Roundhill'
  ELSE manager
END
WHERE manager IS NULL;

-- Seed logo_key from manager (we'll map logo_key -> local asset in UI)
UPDATE public.etfs
SET logo_key = upper(manager)
WHERE logo_key IS NULL AND manager IS NOT NULL;

-- Helpful indexes for filtering
CREATE INDEX IF NOT EXISTS idx_etfs_country ON public.etfs (country);
CREATE INDEX IF NOT EXISTS idx_etfs_manager ON public.etfs (manager);
