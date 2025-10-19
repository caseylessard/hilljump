-- Performance optimization indexes for high-volume queries

-- =====================================================
-- 1. Historical Prices Optimization (52% of DB time)
-- =====================================================
-- Composite index for ticker + date queries
CREATE INDEX IF NOT EXISTS idx_historical_prices_ticker_date 
ON historical_prices (ticker, date DESC);

-- =====================================================
-- 2. Dividends Optimization (3.7% of DB time)
-- =====================================================
-- Composite index for ticker + ex_date queries
CREATE INDEX IF NOT EXISTS idx_dividends_ticker_ex_date 
ON dividends (ticker, ex_date DESC);

-- =====================================================
-- 3. DRIP Cache Optimization
-- =====================================================
-- Ensure efficient conflict resolution on upserts
CREATE INDEX IF NOT EXISTS idx_drip_cache_us_ticker 
ON drip_cache_us (ticker);

CREATE INDEX IF NOT EXISTS idx_drip_cache_ca_ticker 
ON drip_cache_ca (ticker);

-- =====================================================
-- 4. ETF Scores and Rankings Optimization
-- =====================================================
-- Compound index for ON CONFLICT resolution
CREATE INDEX IF NOT EXISTS idx_etf_scores_ticker_country 
ON etf_scores (ticker, country);

-- ETF rankings compound index
CREATE INDEX IF NOT EXISTS idx_etf_rankings_ticker_week 
ON etf_rankings (ticker, week_date DESC);

-- =====================================================
-- 5. Homepage Content Optimization
-- =====================================================
-- Small table, but frequently accessed - ensure it's always cached
CREATE INDEX IF NOT EXISTS idx_homepage_content_key 
ON homepage_content (content_key);

-- =====================================================
-- 6. Run ANALYZE to update statistics
-- =====================================================
-- Update query planner statistics for optimized tables
ANALYZE historical_prices;
ANALYZE dividends;
ANALYZE drip_cache_us;
ANALYZE drip_cache_ca;
ANALYZE etf_scores;
ANALYZE etf_rankings;
ANALYZE homepage_content;