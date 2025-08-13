-- Clean up dummy data and improve ETF data quality
-- Remove $50.00 dummy prices and other invalid data

-- Remove dummy prices of exactly $50
UPDATE etfs 
SET current_price = NULL, price_updated_at = NULL 
WHERE current_price = 50.0;

-- Remove unrealistic yields (over 200%)
UPDATE etfs 
SET yield_ttm = NULL 
WHERE yield_ttm > 200;

-- Remove unrealistic AUM values (less than $1M for active ETFs)
UPDATE etfs 
SET aum = NULL 
WHERE aum < 1000000 AND aum > 0;

-- Remove unrealistic volume values (less than 100 for active ETFs)
UPDATE etfs 
SET avg_volume = NULL 
WHERE avg_volume < 100 AND avg_volume > 0;