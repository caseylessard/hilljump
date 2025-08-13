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
    WHEN aum = 100000000 THEN NULL  -- 1e+08 is clearly dummy
    ELSE aum 
  END,
  avg_volume = CASE 
    WHEN avg_volume = 100000 THEN NULL  -- Standard dummy volume
    ELSE avg_volume 
  END
WHERE 
  yield_ttm IN (10, 12) OR 
  total_return_1y = 10 OR 
  aum = 100000000 OR 
  avg_volume = 100000;