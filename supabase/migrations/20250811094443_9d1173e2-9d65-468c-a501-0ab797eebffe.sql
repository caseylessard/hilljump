-- Remove previously seeded synthetic placeholder ETFs
-- These had tickers like ETF001..ETF090 and names like "Synthetic ETF X"
delete from public.etfs
where ticker ~ '^ETF\d{3}$'
   or name like 'Synthetic ETF %';