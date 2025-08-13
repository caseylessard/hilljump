-- Remove ETFs that have no dividend distributions
-- These are not dividend ETFs and shouldn't be in dividend rankings

-- First, let's see how many we're removing
SELECT 
  COUNT(*) as etfs_to_remove,
  STRING_AGG(e.ticker, ', ') as sample_tickers
FROM etfs e
LEFT JOIN dividends d ON e.ticker = d.ticker
WHERE d.ticker IS NULL;

-- Delete ETFs that have no dividend history
DELETE FROM etfs 
WHERE ticker IN (
  SELECT e.ticker 
  FROM etfs e
  LEFT JOIN dividends d ON e.ticker = d.ticker
  WHERE d.ticker IS NULL
);

-- Show the remaining ETFs count
SELECT 
  COUNT(*) as remaining_dividend_etfs,
  COUNT(DISTINCT d.ticker) as etfs_with_dividends
FROM etfs e
INNER JOIN dividends d ON e.ticker = d.ticker;