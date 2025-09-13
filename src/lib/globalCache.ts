import { supabase } from '@/integrations/supabase/client';
import { getETFs } from '@/lib/db';
import { fetchLatestDistributions } from '@/lib/dividends';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

// Global cache storage - 1 day TTL
const globalCache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day in milliseconds

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
  console.log(`💾 Cached data for: ${key} (expires in 24 hours)`);
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

export const getCachedGlobalDRIP = async (tickers: string[], taxPreferences?: { country: string, enabled: boolean, rate: number }) => {
  const cacheKey = `drip-${tickers.slice(0, 50).sort().join(',')}-${JSON.stringify(taxPreferences)}`;
  
  // Check if data exists and is fresh (within 1 hour)
  const cached = globalCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < 60 * 60 * 1000) {
    console.log('🎯 Using cached DRIP data for', tickers.length, 'tickers');
    return cached.data;
  }

  console.log('🔄 Fetching fresh DRIP data for', tickers.length, 'tickers');
  
  // Force fresh fetch by clearing the cache
  globalCache.delete(cacheKey);
  
  try {
    // Determine which cache table to use based on tax preferences
    const tableName = (taxPreferences?.country === 'CA' && taxPreferences?.enabled) 
      ? 'drip_cache_ca' 
      : 'drip_cache_us';
    
    console.log(`📊 Using DRIP table: ${tableName}`);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('ticker, period_4w, period_13w, period_26w, period_52w, updated_at')
      .in('ticker', tickers);
    
    if (error) {
      console.error('❌ DRIP fetch error:', error);
      return {};
    }
    
    // Check if cache is empty or stale - trigger fallback calculation
    const hasValidData = data?.some(row => {
      const parseField = (field: any) => {
        if (!field) return null;
        if (typeof field === 'string') {
          try { return JSON.parse(field); } catch { return null; }
        }
        return field;
      };
      
      const parsed4w = parseField(row.period_4w);
      const parsed13w = parseField(row.period_13w);
      const parsed26w = parseField(row.period_26w);  
      const parsed52w = parseField(row.period_52w);
      
      const hasValid = (parsed4w && parsed4w.growthPercent !== undefined) ||
                      (parsed13w && parsed13w.growthPercent !== undefined) ||
                      (parsed26w && parsed26w.growthPercent !== undefined) ||
                      (parsed52w && parsed52w.growthPercent !== undefined);
      
      // Debug specific tickers
      if (row.ticker === 'AAPW' || row.ticker === 'MSTY') {
        console.log(`🔍 ${row.ticker} validation debug:`, {
          period_4w_type: typeof row.period_4w,
          period_4w_raw: row.period_4w,
          parsed4w_growth: parsed4w?.growthPercent,
          hasValid,
          updated_at: row.updated_at
        });
      }
      
      return hasValid;
    });
    
    console.log(`📊 DRIP Cache Check: ${data?.length || 0} records, ${hasValidData ? 'HAS' : 'MISSING'} valid data`);
    
    // Debug: Show actual data structure
    if (data?.length > 0) {
      const sampleData = data[0];
      console.log(`🔍 Sample DRIP data structure:`, {
        ticker: sampleData.ticker,
        period_4w_type: typeof sampleData.period_4w,
        period_4w_value: sampleData.period_4w,
        has_growth_percent: sampleData.period_4w && typeof sampleData.period_4w === 'object' && 'growthPercent' in sampleData.period_4w
      });
    }
    
    let finalData = data; // Use a mutable variable
    
    if (!hasValidData && tickers.length > 0) {
      console.log('🚨 DRIP cache empty, triggering fallback calculation...');
      try {
        const taxCountry = (taxPreferences?.country === 'CA' && taxPreferences?.enabled) ? 'CA' : 'US';
        console.log(`📊 Triggering fallback for ${tickers.slice(0, 10).join(', ')}`);
        
        const response = await supabase.functions.invoke('calculate-drip-fallback', {
          body: { tickers: tickers.slice(0, 10), taxCountry }
        });
        
        console.log('✅ Fallback response:', response);
        
        if (response.data?.success) {
          // Refetch the data after calculation
          console.log('🔄 Refetching DRIP data after fallback calculation...');
          const { data: freshData } = await supabase
            .from(tableName)
            .select('ticker, period_4w, period_13w, period_26w, period_52w, updated_at')
            .in('ticker', tickers);
          
          if (freshData && freshData.some(row => row.period_4w || row.period_13w || row.period_26w || row.period_52w)) {
            console.log('✅ Fresh DRIP data available after fallback');
            finalData = freshData; // Use fresh data
          }
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback calculation failed:', fallbackError);
      }
    }
    
    console.log(`📊 DRIP Debug - Raw data sample:`, finalData?.slice(0, 2));
    
    const result: Record<string, any> = {};
    finalData?.forEach(row => {
      // Debug the actual structure
      if (Math.random() < 0.1) {
        console.log('🔍 DRIP Row Debug:', {
          ticker: row.ticker,
          period_4w: row.period_4w,
          period_13w: row.period_13w
        });
      }
      
      // Parse structured DRIP data and convert to expected format
      const parseToLegacyFormat = (periodData: any) => {
        if (!periodData) return null;
        
        // Handle JSON strings from database
        let parsedData = periodData;
        if (typeof periodData === 'string') {
          try {
            parsedData = JSON.parse(periodData);
          } catch (e) {
            console.warn('Failed to parse DRIP JSON:', periodData);
            return null;
          }
        }
        
        if (!parsedData || typeof parsedData !== 'object') return null;
        
        // Extract values from structured data
        const growthPercent = parsedData.growthPercent || 0;
        const totalDividends = parsedData.totalDividends || 0;
        const startPrice = parsedData.startPrice || 1;
        
        // Calculate dollar amount from percentage and starting price
        const dollarAmount = (growthPercent / 100) * startPrice;
        
        return {
          percent: growthPercent,
          dollar: dollarAmount,
          startPrice: startPrice,
          endPrice: parsedData.endPrice || startPrice,
          totalDividends: totalDividends,
          endShares: parsedData.endShares || 1
        };
      };
      
      result[row.ticker] = {
        // Convert structured data to expected format for backwards compatibility
        drip4wPercent: parseToLegacyFormat(row.period_4w)?.percent || 0,
        drip4wDollar: parseToLegacyFormat(row.period_4w)?.dollar || 0,
        drip13wPercent: parseToLegacyFormat(row.period_13w)?.percent || 0,
        drip13wDollar: parseToLegacyFormat(row.period_13w)?.dollar || 0,
        drip26wPercent: parseToLegacyFormat(row.period_26w)?.percent || 0,
        drip26wDollar: parseToLegacyFormat(row.period_26w)?.dollar || 0,
        drip52wPercent: parseToLegacyFormat(row.period_52w)?.percent || 0,
        drip52wDollar: parseToLegacyFormat(row.period_52w)?.dollar || 0,
        
        // Also store the raw structured data for advanced use
        '4w': row.period_4w,
        '13w': row.period_13w,
        '26w': row.period_26w,
        '52w': row.period_52w,
        lastUpdated: row.updated_at
      };
    });
    
    // Cache the result
    setGlobalCache(cacheKey, result);
    
    // Debug final result for key tickers
    if (result.AAPW || result.MSTY) {
      console.log(`🎯 Final DRIP result for key tickers:`, {
        AAPW: result.AAPW ? {
          drip4wPercent: result.AAPW.drip4wPercent,
          drip13wPercent: result.AAPW.drip13wPercent,
          raw4w: result.AAPW['4w']
        } : 'not found',
        MSTY: result.MSTY ? {
          drip4wPercent: result.MSTY.drip4wPercent,
          drip13wPercent: result.MSTY.drip13wPercent,
          raw4w: result.MSTY['4w']
        } : 'not found'
      });
    }
    
    console.log(`✅ Cached DRIP data for ${Object.keys(result).length} tickers`);
    return result;
    
  } catch (error) {
    console.error('❌ DRIP fetch failed:', error);
    return {};
  }
};

export const refreshDRIPData = async (tickers: string[], taxPreferences?: any): Promise<Record<string, any>> => {
  console.log('🔄 Refreshing DRIP data with fresh calculations...');
  
  try {
    const { data, error } = await supabase.functions.invoke('calculate-drip', {
      body: { 
        tickers,
        taxPrefs: {
          country: taxPreferences?.country || 'US',
          withholdingTax: taxPreferences?.enabled || false,
          taxRate: (taxPreferences?.rate || 0.15) * 100  // Convert decimal to percentage for edge function
        }
      }
    });

    if (error) throw error;
    
    const rawDripData = data?.dripData || {};
    
    // Normalize the data format to match cached data structure
    const normalizedDripData: Record<string, any> = {};
    
    Object.entries(rawDripData).forEach(([ticker, tickerData]: [string, any]) => {
      normalizedDripData[ticker] = {
        // Keep the raw format for compatibility
        ...tickerData,
        // Ensure percentage values are directly accessible
        drip4wPercent: tickerData.drip4wPercent || 0,
        drip4wDollar: tickerData.drip4wDollar || 0,
        drip13wPercent: tickerData.drip13wPercent || 0,
        drip13wDollar: tickerData.drip13wDollar || 0,
        drip26wPercent: tickerData.drip26wPercent || 0,
        drip26wDollar: tickerData.drip26wDollar || 0,
        drip52wPercent: tickerData.drip52wPercent || 0,
        drip52wDollar: tickerData.drip52wDollar || 0,
        lastUpdated: new Date().toISOString()
      };
    });
    
    console.log('🔄 Normalized fresh DRIP data:', Object.keys(normalizedDripData).length, 'tickers');
    console.log('🔍 Sample normalized data:', Object.values(normalizedDripData)[0]);
    
    // Update cache with normalized data
    const cacheKey = `global-drip-${tickers.sort().join(',')}-${JSON.stringify(taxPreferences)}`;
    setGlobalCache(cacheKey, normalizedDripData);
    
    return normalizedDripData;
  } catch (error) {
    console.error('❌ DRIP refresh failed:', error);
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
export const warmGlobalCache = async (forceRefresh = false) => {
  console.log(`🔥 ${forceRefresh ? 'Force refreshing' : 'Warming'} global cache with progressive loading...`);
  
  try {
    // Clear expired entries first, or all if force refresh
    if (forceRefresh) {
      globalCache.clear();
      console.log('🗑️ Cleared all cache entries for force refresh');
    } else {
      clearExpiredCache();
    }
    
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
    
    console.log(`✅ Global cache ${forceRefresh ? 'refreshed' : 'warmed'} successfully with progressive loading`);
  } catch (error) {
    console.error(`❌ Cache ${forceRefresh ? 'refresh' : 'warming'} failed:`, error);
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