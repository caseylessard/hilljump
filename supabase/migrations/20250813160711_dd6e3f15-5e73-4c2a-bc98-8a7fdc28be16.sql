-- Remove the 5-minute ETF data fetch cron job to save costs
-- Keep the daily dividend updater for scheduled maintenance
SELECT cron.unschedule('fetch-etf-data-every-5min');