-- Clear all existing dividend data to start fresh
DELETE FROM dividends;

-- Clear DRIP caches since dividend data is being refreshed
DELETE FROM drip_cache_us;
DELETE FROM drip_cache_ca;

-- Clear any dividend update logs to start fresh tracking
DELETE FROM dividend_update_logs;