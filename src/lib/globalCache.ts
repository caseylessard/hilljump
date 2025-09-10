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

// Add a promise cache to prevent multiple simultaneous calls
const pricePromiseCache = new Map<string, Promise<Record<string, any>>>();

export const getCachedGlobalPrices = async (tickers: string[]): Promise<Record<string, any>> => {
  const cacheKey = `global-prices-${tickers.sort().join(',')}`;
  
  // Check memory cache first
  const cached = getFromGlobalCache<Record<string, any>>(cacheKey);
  if (cached) {
    console.log('📋 Using cached prices:', Object.keys(cached).length, 'ETFs');
    return cached;
  }

  // Check if we're already fetching this data
  if (pricePromiseCache.has(cacheKey)) {
    console.log('⏳ Deduplicating price fetch request');
    return pricePromiseCache.get(cacheKey)!;
  }

  // Create and cache the promise
  const fetchPromise = (async () => {
    console.log('🔄 Loading prices for', tickers.length, 'tickers from database...');
    
    try {
      // Always start with database prices for instant loading
      const { data: dbPrices, error: dbError } = await supabase
        .from('etfs')
        .select('ticker, current_price, price_updated_at')
        .in('ticker', tickers)
        .not('current_price', 'is', null);

      if (dbError) {
        console.error('❌ Database price fetch error:', dbError);
        return {};
      }

      const prices: Record<string, any> = {};
      let dbPriceCount = 0;
      
      dbPrices?.forEach(etf => {
        if (etf.current_price && etf.current_price > 0) {
          prices[etf.ticker] = {
            price: etf.current_price,
            source: 'database',
            priceUpdatedAt: etf.price_updated_at
          };
          dbPriceCount++;
        }
      });
      
      console.log(`✅ Loaded ${dbPriceCount} prices from database (${Math.round(dbPriceCount/tickers.length*100)}% coverage)`);

      // Only fetch live prices if we have very low coverage (<25%)
      if (dbPriceCount < tickers.length * 0.25) {
        console.log('🔴 Very low database coverage, fetching live prices...');
        try {
          const { data: liveData, error: liveError } = await supabase.functions.invoke('quotes', {
            body: { tickers: tickers.filter(t => !prices[t]) }
          });

          if (!liveError && liveData?.prices) {
            let liveCount = 0;
            Object.entries(liveData.prices).forEach(([ticker, price]) => {
              if (typeof price === 'number' && price > 0 && !prices[ticker]) {
                prices[ticker] = {
                  price,
                  source: 'live',
                  priceUpdatedAt: new Date().toISOString()
                };
                liveCount++;
              }
            });
            console.log('📈 Added', liveCount, 'live prices');
          }
        } catch (liveError) {
          console.error('❌ Live price fetch failed:', liveError);
        }
      }

      const finalPriceCount = Object.keys(prices).length;
      console.log(`💾 Caching ${finalPriceCount} prices for ${tickers.length} tickers (${Math.round(finalPriceCount/tickers.length*100)}% coverage)`);
      
      setGlobalCache(cacheKey, prices);
      return prices;
    } catch (error) {
      console.error('❌ getCachedGlobalPrices failed:', error);
      return {};
    } finally {
      // Clear the promise cache when done
      pricePromiseCache.delete(cacheKey);
    }
  })();

  // Cache the promise to prevent duplicate calls
  pricePromiseCache.set(cacheKey, fetchPromise);
  return fetchPromise;
};

export const getCachedGlobalDistributions = async (tickers: string[]): Promise<Record<string, any>> => {
  const cacheKey = `global-distributions-${tickers.sort().join(',')}`;
  const cached = getFromGlobalCache<Record<string, any>>(cacheKey);
  if (cached) {
    console.log('📋 Using cached distributions for', Object.keys(cached).length, 'ETFs');
    return cached;
  }

  console.log('🔄 Fetching fresh distribution data for', tickers.length, 'tickers...');
  try {
    const distributions = await fetchLatestDistributions(tickers);
    console.log('💰 Fetched distributions for', Object.keys(distributions).length, 'ETFs');
    setGlobalCache(cacheKey, distributions);
    return distributions;
  } catch (error) {
    console.error('❌ Distribution fetch failed:', error);
    return {};
  }
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
  if (cached) {
    console.log('📋 Using cached historical data for', Object.keys(cached).length, 'ETFs');
    return cached;
  }

  console.log('🔄 Fetching fresh historical price data for', tickers.length, 'tickers...');
  
  try {
    // Use bulk query instead of individual requests for better performance
    const { data, error } = await supabase
      .from('historical_prices')
      .select('ticker, close_price, date')
      .in('ticker', tickers)
      .not('close_price', 'is', null) // Ensure we only get valid prices
      .order('ticker')
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Historical prices bulk fetch error:', error);
      return {};
    }

    console.log(`🔍 Raw historical data query returned ${data?.length || 0} records`);
    
    const historicalPrices: Record<string, number[]> = {};
    
    // Group by ticker and limit to 520 most recent entries per ticker
    const tickerData: Record<string, any[]> = {};
    data?.forEach(row => {
      if (!tickerData[row.ticker]) tickerData[row.ticker] = [];
      if (tickerData[row.ticker].length < 520) {
        tickerData[row.ticker].push(row);
      }
    });

    console.log(`🔍 Grouped data for tickers: ${Object.keys(tickerData).join(', ')}`);

    // Convert to price arrays (reverse to get chronological order)
    Object.entries(tickerData).forEach(([ticker, rows]) => {
      if (rows.length > 0) {
        const prices = rows
          .map(d => d.close_price)
          .filter(price => price && isFinite(price) && price > 0)
          .reverse();
        
        if (prices.length > 0) {
          historicalPrices[ticker] = prices;
          console.log(`✅ Loaded ${prices.length} prices for ${ticker}`);
        }
      }
    });

    console.log(`✅ Loaded historical data for ${Object.keys(historicalPrices).length} ETFs via bulk query`);
    
    // Log any missing tickers for debugging
    const missingTickers = tickers.filter(t => !historicalPrices[t]);
    if (missingTickers.length > 0) {
      console.log(`⚠️ No historical data found for: ${missingTickers.slice(0, 10).join(', ')}${missingTickers.length > 10 ? ` and ${missingTickers.length - 10} more` : ''}`);
    }
    
    setGlobalCache(cacheKey, historicalPrices);
    return historicalPrices;
  } catch (error) {
    console.error('❌ getCachedGlobalHistoricalPrices failed:', error);
    return {};
  }
};

// Enhanced cache warming with progressive loading strategy
export const warmGlobalCache = async () => {
  console.log('🔥 Warming global cache with progressive loading...');
  
  try {
    // Clear expired entries first
    clearExpiredCache();
    
    // Get ETFs first
    const etfs = await getCachedGlobalETFs();
    const tickers = etfs.map((etf: any) => etf.ticker);
    
    // Progressive loading: warm most critical data first
    console.log('🔥 Phase 1: Loading critical price data...');
    await getCachedGlobalPrices(tickers.slice(0, 100)); // Top 100 ETFs first
    
    console.log('🔥 Phase 2: Loading remaining data in parallel...');
    // Warm all other caches in parallel, with remaining tickers
    await Promise.allSettled([
      getCachedGlobalPrices(tickers.slice(100)), // Remaining ETFs
      getCachedGlobalDistributions(tickers),
      getCachedGlobalHistoricalPrices(tickers.slice(0, 200)), // Top 200 for historical (increased from 50)
      getCachedGlobalDRIP(tickers.slice(0, 100)) // Top 100 for DRIP (increased from 50)
    ]);
    
    console.log('✅ Global cache warmed successfully with progressive loading');
  } catch (error) {
    console.error('❌ Cache warming failed:', error);
  }
};

// Selective cache warming for specific data types
export const warmSpecificCache = async (type: 'prices' | 'distributions' | 'historical' | 'drip', tickers?: string[]) => {
  try {
    const targetTickers = tickers || (await getCachedGlobalETFs()).map((etf: any) => etf.ticker);
    
    switch (type) {
      case 'prices':
        await getCachedGlobalPrices(targetTickers);
        break;
      case 'distributions':
        await getCachedGlobalDistributions(targetTickers);
        break;
      case 'historical':
        await getCachedGlobalHistoricalPrices(targetTickers);
        break;
      case 'drip':
        await getCachedGlobalDRIP(targetTickers);
        break;
    }
    
    console.log(`✅ Warmed ${type} cache for ${targetTickers.length} tickers`);
  } catch (error) {
    console.error(`❌ Failed to warm ${type} cache:`, error);
  }
};