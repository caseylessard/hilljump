-- Fix Canadian stocks currency and provider issues
-- Set currency to CAD for all Canadian stocks
UPDATE etfs 
SET currency = 'CAD' 
WHERE country = 'CA' AND currency != 'CAD';

-- Fix manager for Canadian YieldMax funds that should be Harvest
-- TSLY.TO, CONY.TO, MSTY.TO should be managed by Harvest based on the Canadian pattern
UPDATE etfs 
SET manager = 'Harvest'
WHERE ticker IN ('TSLY.TO', 'CONY.TO', 'MSTY.TO') 
AND manager = 'YieldMax';