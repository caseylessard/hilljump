-- Update data_source to use proper data providers instead of stooq
UPDATE public.etfs 
SET data_source = CASE 
  WHEN country = 'US' AND polygon_supported = true THEN 'polygon'
  WHEN country = 'CA' THEN 'twelvedata'
  ELSE 'twelvedata'
END;