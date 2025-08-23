-- Remove unused columns from etfs table, but keep price_updated_at
ALTER TABLE public.etfs 
DROP COLUMN IF EXISTS twelve_feed_quote,
DROP COLUMN IF EXISTS twelve_feed_timeseries,
DROP COLUMN IF EXISTS finnhub_feed_quote,
DROP COLUMN IF EXISTS eodhd_feed_eod,
DROP COLUMN IF EXISTS polygon_feed,
DROP COLUMN IF EXISTS twelve_ws_url,
DROP COLUMN IF EXISTS finnhub_ws_url,
DROP COLUMN IF EXISTS finnhub_ws_subscribe,
DROP COLUMN IF EXISTS eodhd_ws_url,
DROP COLUMN IF EXISTS exchange_normalized,
DROP COLUMN IF EXISTS exchange_code,
DROP COLUMN IF EXISTS mic_code,
DROP COLUMN IF EXISTS polygon_ticker,
DROP COLUMN IF EXISTS created_at,
DROP COLUMN IF EXISTS updated_at,
DROP COLUMN IF EXISTS last_dividend_update;