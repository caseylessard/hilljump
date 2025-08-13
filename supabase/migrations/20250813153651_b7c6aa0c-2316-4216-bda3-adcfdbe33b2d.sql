-- Populate data_source column based on actual data fetching behavior
UPDATE public.etfs 
SET data_source = CASE 
  WHEN country = 'US' AND (polygon_supported = true OR polygon_supported IS NULL) THEN 'polygon'
  WHEN country = 'CA' THEN 'stooq'
  ELSE 'twelvedata'
END
WHERE data_source IS NULL;