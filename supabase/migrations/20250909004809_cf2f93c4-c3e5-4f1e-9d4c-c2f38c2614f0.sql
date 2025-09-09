-- Remove ETFs that don't have any dividend distributions
-- This will clean up the database by removing ETFs without dividend data

-- First, let's see what we're working with (for logging purposes)
DO $$
DECLARE
  total_etfs INTEGER;
  etfs_with_dividends INTEGER;
  etfs_to_delete INTEGER;
BEGIN
  -- Count total ETFs
  SELECT COUNT(*) INTO total_etfs FROM etfs;
  
  -- Count ETFs with dividends
  SELECT COUNT(DISTINCT ticker) INTO etfs_with_dividends 
  FROM etfs e 
  WHERE EXISTS (
    SELECT 1 FROM dividends d WHERE d.ticker = e.ticker
  );
  
  -- Calculate ETFs to delete
  etfs_to_delete := total_etfs - etfs_with_dividends;
  
  RAISE NOTICE 'Total ETFs: %, ETFs with dividends: %, ETFs to delete: %', 
    total_etfs, etfs_with_dividends, etfs_to_delete;
END $$;

-- Delete related data first to avoid any potential issues
-- Delete rankings for ETFs without dividends
DELETE FROM etf_rankings 
WHERE ticker IN (
  SELECT e.ticker 
  FROM etfs e 
  WHERE NOT EXISTS (
    SELECT 1 FROM dividends d WHERE d.ticker = e.ticker
  )
);

-- Delete scores for ETFs without dividends
DELETE FROM etf_scores 
WHERE ticker IN (
  SELECT e.ticker 
  FROM etfs e 
  WHERE NOT EXISTS (
    SELECT 1 FROM dividends d WHERE d.ticker = e.ticker
  )
);

-- Delete price cache for ETFs without dividends
DELETE FROM price_cache 
WHERE ticker IN (
  SELECT e.ticker 
  FROM etfs e 
  WHERE NOT EXISTS (
    SELECT 1 FROM dividends d WHERE d.ticker = e.ticker
  )
);

-- Delete DRIP cache for ETFs without dividends
DELETE FROM drip_cache_us 
WHERE ticker IN (
  SELECT e.ticker 
  FROM etfs e 
  WHERE NOT EXISTS (
    SELECT 1 FROM dividends d WHERE d.ticker = e.ticker
  )
);

DELETE FROM drip_cache_ca 
WHERE ticker IN (
  SELECT e.ticker 
  FROM etfs e 
  WHERE NOT EXISTS (
    SELECT 1 FROM dividends d WHERE d.ticker = e.ticker
  )
);

-- Delete historical prices for ETFs without dividends
DELETE FROM historical_prices 
WHERE ticker IN (
  SELECT e.ticker 
  FROM etfs e 
  WHERE NOT EXISTS (
    SELECT 1 FROM dividends d WHERE d.ticker = e.ticker
  )
);

-- Finally, delete the ETFs themselves
DELETE FROM etfs 
WHERE ticker NOT IN (
  SELECT DISTINCT ticker FROM dividends
);

-- Log the cleanup results
DO $$
DECLARE
  remaining_etfs INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_etfs FROM etfs;
  RAISE NOTICE 'Cleanup complete. Remaining ETFs: %', remaining_etfs;
END $$;