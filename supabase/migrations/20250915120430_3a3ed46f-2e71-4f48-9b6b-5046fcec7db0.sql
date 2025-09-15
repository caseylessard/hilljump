-- Fix Canadian stocks that are incorrectly marked as US
-- Any ticker with .TO or .NE suffix should be marked as Canadian

UPDATE etfs 
SET country = 'CA' 
WHERE (ticker LIKE '%.TO' OR ticker LIKE '%.NE') 
AND country != 'CA';