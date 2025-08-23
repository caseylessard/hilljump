-- Reset placeholder prices to null for ETFs where we couldn't find real prices
-- These need proper price discovery or should be marked as inactive

UPDATE etfs SET current_price = NULL, price_updated_at = NULL 
WHERE ticker IN ('BCCL.NE', 'RSCL.NE', 'BANK', 'QDAY.NE', 'SQY', 'EMCL.NE', 'SDAY.NE', 'EACL.NE', 'CDAY.NE', 'MAGY');