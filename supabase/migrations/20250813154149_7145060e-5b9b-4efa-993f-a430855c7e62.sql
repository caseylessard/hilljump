-- Remove dummy data by setting clearly fake values to NULL
UPDATE public.etfs 
SET 
  yield_ttm = CASE 
    WHEN yield_ttm = 12 THEN NULL 
    WHEN yield_ttm = 10 THEN NULL
    ELSE yield_ttm 
  END,
  total_return_1y = CASE 
    WHEN total_return_1y = 10 THEN NULL 
    ELSE total_return_1y 
  END,
  aum = CASE 
    WHEN aum = 100000000 THEN NULL
    ELSE aum 
  END,
  avg_volume = CASE 
    WHEN avg_volume = 100000 THEN NULL
    ELSE avg_volume 
  END;