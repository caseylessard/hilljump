-- Clean up MSTY duplicate dividends for August 2025
-- Keep only the latest payment (8/29) and remove the duplicate (8/28)
DELETE FROM dividends 
WHERE ticker = 'MSTY' 
  AND ex_date = '2025-08-28' 
  AND amount = 1.09;

-- Clear DRIP cache to force recalculation
DELETE FROM drip_cache_us WHERE ticker = 'MSTY';
DELETE FROM drip_cache_ca WHERE ticker = 'MSTY';