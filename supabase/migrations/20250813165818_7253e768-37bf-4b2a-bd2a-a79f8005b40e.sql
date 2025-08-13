-- Update Canadian ETFs to use EODHD as data source
UPDATE public.etfs 
SET data_source = 'eodhd',
    eodhd_symbol = ticker
WHERE country = 'CA' 
   OR exchange LIKE '%TSX%' 
   OR ticker LIKE '%.TO';