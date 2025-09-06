-- Update MSTY dividend to correct amount
UPDATE dividends 
SET amount = 1.0899 
WHERE ticker = 'MSTY' 
  AND ex_date = '2025-08-29' 
  AND amount = 1.25;

-- Clear DRIP cache to force recalculation with correct amount
DELETE FROM drip_cache_us WHERE ticker = 'MSTY';
DELETE FROM drip_cache_ca WHERE ticker = 'MSTY';