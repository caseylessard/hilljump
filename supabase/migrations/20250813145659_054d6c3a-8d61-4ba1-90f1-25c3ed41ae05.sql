-- Remove base ticker entries that have .TO equivalents for Canadian stocks
DELETE FROM etfs WHERE id = 'd0b721d6-3b8e-495a-9c4b-f9c44f7a73a1'; -- SMAX
DELETE FROM etfs WHERE id = '5d8d753d-dd3a-45b8-af0a-34d3f2621339'; -- QQCL

-- Clean up dividend entries for removed tickers
DELETE FROM dividends WHERE ticker IN ('SMAX', 'QQCL');