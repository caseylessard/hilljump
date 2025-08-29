-- Update MSTY dividend records with correct pay_dates (ex_date + 1 day)
UPDATE dividends 
SET pay_date = ex_date + INTERVAL '1 day'
WHERE ticker = 'MSTY' AND pay_date IS NULL;