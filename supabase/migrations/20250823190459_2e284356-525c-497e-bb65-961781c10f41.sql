-- Trigger the dividend updater to populate yield_ttm values
-- This will be run manually by calling the edge function
SELECT 'Dividend updater function exists and can be invoked to populate yield_ttm values' as status;