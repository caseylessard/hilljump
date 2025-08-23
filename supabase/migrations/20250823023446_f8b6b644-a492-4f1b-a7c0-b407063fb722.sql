-- Fix currency for Canadian tickers (those ending in .TO or .NE)
UPDATE etfs 
SET currency = 'CAD' 
WHERE (ticker LIKE '%.TO' OR ticker LIKE '%.NE') 
AND currency != 'CAD';

-- Also fix country for proper identification
UPDATE etfs 
SET country = 'CA' 
WHERE (ticker LIKE '%.TO' OR ticker LIKE '%.NE') 
AND country != 'CA';