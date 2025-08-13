-- Remove duplicate SMAX entry and standardize to .TO format for Canadian stocks
DELETE FROM etfs WHERE ticker = 'SMAX' AND country = 'CA';

-- Ensure all Canadian stocks use .TO format consistently
UPDATE etfs 
SET ticker = ticker || '.TO' 
WHERE country = 'CA' 
AND exchange = 'TSX' 
AND ticker NOT LIKE '%.TO';

-- Clean up any duplicate dividend entries
DELETE FROM dividends 
WHERE ticker = 'SMAX' 
AND EXISTS (SELECT 1 FROM dividends d2 WHERE d2.ticker = 'SMAX.TO' AND d2.ex_date = dividends.ex_date);