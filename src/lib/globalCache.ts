import { supabase } from '@/integrations/supabase/client';
import { getETFs } from '@/lib/db';
import { fetchLatestDistributions } from '@/lib/dividends';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

// Global cache storage - 1 hour TTL
const globalCache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Helper to check if cache entry is valid
const isCacheValid = (entry: CacheEntry<any>): boolean => {
  return Date.now() < entry.expires;
};

// Generic cache getter/setter
export const getFromGlobalCache = <T>(key: string): T | null => {
  const entry = globalCache.get(key);
  if (entry && isCacheValid(entry)) {
    console.log(`📋 Using cached data for: ${key}`);
    return entry.data;
  }
  return null;
};

export const setGlobalCache = <T>(key: string, data: T): void => {
  const now = Date.now();
  globalCache.set(key, {
    data,
    timestamp: now,
    expires: now + CACHE_DURATION
  });
  console.log(`💾 Cached data for: ${key} (expires in 1 hour)`);
};

// Clear expired entries
export const clearExpiredCache = (): void => {
  const now = Date.now();
  for (const [key, entry] of globalCache.entries()) {
    if (now >= entry.expires) {
      globalCache.delete(key);
      console.log(`🗑️ Cleared expired cache: ${key}`);
    }
  }
};

// Main data fetchers with global caching
export const getCachedGlobalETFs = async (): Promise<any[]> => {
  const cacheKey = 'global-etfs';
  const cached = getFromGlobalCache<any[]>(cacheKey);
  if (cached) return cached;

  console.log('🔄 Fetching fresh ETF data...');
  const etfs = await getETFs();
  setGlobalCache(cacheKey, etfs);
  return etfs;
};

export const getCachedGlobalPrices = async (tickers: string[]): Promise<Record<string, any>> => {
  console.log('🔄 getCachedGlobalPrices called with', tickers.length, 'tickers');
  
  const cacheKey = `global-prices-${tickers.sort().join(',')}`;
  const cached = getFromGlobalCache<Record<string, any>>(cacheKey);
  if (cached) {
    console.log('📋 Using cached prices:', Object.keys(cached).length);
    return cached;
  }

  console.log('🔄 Fetching fresh price data for', tickers.length, 'tickers...');
  
  try {
    // Get database prices
    const { data: dbPrices, error: dbError } = await supabase
      .from('etfs')
      .select('ticker, current_price, price_updated_at')
      .in('ticker', tickers)
      .not('current_price', 'is', null);

    if (dbError) {
      console.error('❌ Database price fetch error:', dbError);
      // Don't return empty, try live fetch as fallback
    }

    console.log('📊 Database returned', dbPrices?.length || 0, 'price records');
    
    const prices: Record<string, any> = {};
    dbPrices?.forEach(etf => {
      if (etf.current_price && etf.current_price > 0) {
        prices[etf.ticker] = {
          price: etf.current_price,
          source: 'database',
          priceUpdatedAt: etf.price_updated_at
        };
      }
    });
    
    console.log('💰 Processed prices for', Object.keys(prices).length, 'ETFs');

    // Fetch live prices and update database
    try {
      const { data: liveData } = await supabase.functions.invoke('quotes', {
        body: { tickers }
      });

      if (liveData?.prices) {
        Object.entries(liveData.prices).forEach(([ticker, price]) => {
          if (typeof price === 'number' && price > 0) {
            prices[ticker] = {
              price,
              source: 'live',
              priceUpdatedAt: new Date().toISOString()
            };
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Live price fetch failed:', error);
    }

    console.log('💾 Caching prices:', Object.keys(prices).length, 'ETFs');
    setGlobalCache(cacheKey, prices);
    return prices;
  } catch (error) {
    console.error('❌ getCachedGlobalPrices failed:', error);
    return {};
  }
};

export const getCachedGlobalDistributions = async (tickers: string[]): Promise<Record<string, any>> => {
  const cacheKey = `global-distributions-${tickers.sort().join(',')}`;
  const cached = getFromGlobalCache<Record<string, any>>(cacheKey);
  if (cached) return cached;

  console.log('🔄 Fetching fresh distribution data...');
  const distributions = await fetchLatestDistributions(tickers);
  setGlobalCache(cacheKey, distributions);
  return distributions;
};

export const getCachedGlobalDRIP = async (tickers: string[], taxPreferences?: any): Promise<Record<string, any>> => {
  const cacheKey = `global-drip-${tickers.sort().join(',')}-${JSON.stringify(taxPreferences)}`;
  const cached = getFromGlobalCache<Record<string, any>>(cacheKey);
  if (cached) return cached;

  console.log('🔄 Calculating fresh DRIP data...');
  
  try {
    const { data, error } = await supabase.functions.invoke('calculate-drip', {
      body: { 
        tickers,
        taxPrefs: {
          country: taxPreferences?.country || 'US',
          withholdingTax: taxPreferences?.enabled || false,
          taxRate: (taxPreferences?.rate || 0.15) * 100
        }
      }
    });

    if (error) throw error;
    
    const dripData = data?.dripData || {};
    setGlobalCache(cacheKey, dripData);
    return dripData;
  } catch (error) {
    console.error('❌ DRIP calculation failed:', error);
    return {};
  }
};

export const getCachedGlobalHistoricalPrices = async (tickers: string[]): Promise<Record<string, number[]>> => {
  const cacheKey = `global-historical-${tickers.sort().join(',')}`;
  const cached = getFromGlobalCache<Record<string, number[]>>(cacheKey);
  if (cached) return cached;

  console.log('🔄 Fetching fresh historical price data...');
  
  const historicalPrices: Record<string, number[]> = {};
  
  // Fetch 520 days of historical data for each ticker
  for (const ticker of tickers) {
    try {
      const { data } = await supabase
        .from('historical_prices')
        .select('close_price')
        .eq('ticker', ticker)
        .order('date', { ascending: false })
        .limit(520);
      
      if (data && data.length > 0) {
        historicalPrices[ticker] = data.map(d => d.close_price).reverse();
      }
    } catch (error) {
      console.warn(`Failed to fetch historical data for ${ticker}:`, error);
    }
  }

  setGlobalCache(cacheKey, historicalPrices);
  return historicalPrices;
};

// Warm all caches (called by Ranking page)
export const warmGlobalCache = async () => {
  console.log('🔥 Warming global cache...');
  
  try {
    // Clear expired entries first
    clearExpiredCache();
    
    // Get ETFs first
    const etfs = await getCachedGlobalETFs();
    const tickers = etfs.map((etf: any) => etf.ticker);
    
    // Warm all other caches in parallel
    await Promise.allSettled([
      getCachedGlobalPrices(tickers),
      getCachedGlobalDistributions(tickers),
      getCachedGlobalHistoricalPrices(tickers),
      getCachedGlobalDRIP(tickers)
    ]);
    
    console.log('✅ Global cache warmed successfully');
  } catch (error) {
    console.error('❌ Cache warming failed:', error);
  }
};