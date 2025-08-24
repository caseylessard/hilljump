// Cache service for ETF data with configurable TTLs
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // TTL in milliseconds
}

interface CacheConfig {
  ranking: number;
  price: number;
  lastDist: number;
  nextDist: number;
  drip4w: number;
  drip13w: number;
  drip26w: number;
  drip52w: number;
  yield: number;
  risk: number;
  score: number;
  signal: number;
}

// Helper to check if it's weekend or market closed
function isMarketClosed(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();
  
  // Weekend (Saturday/Sunday)
  if (day === 0 || day === 6) return true;
  
  // Market hours: 9:30 AM to 4 PM ET (approximate)
  // This is a simplified check - real implementation would consider holidays
  if (hour < 9 || hour >= 16) return true;
  
  return false;
}

// Dynamic TTL calculation for prices
function getPriceTTL(): number {
  if (isMarketClosed()) {
    // During weekends/after hours, cache prices longer
    return 24 * 60 * 60 * 1000; // 24 hours
  }
  return 15 * 60 * 1000; // 15 minutes during market hours
}

// Cache TTLs in milliseconds
export const CACHE_TTLS: CacheConfig = {
  ranking: 60 * 60 * 1000,      // 1 hour
  price: getPriceTTL(),         // Dynamic: 15 min (market hours) / 24 hours (weekends)
  lastDist: 24 * 60 * 60 * 1000, // 1 day
  nextDist: 24 * 60 * 60 * 1000, // 1 day
  drip4w: 60 * 60 * 1000,       // 1 hour
  drip13w: 60 * 60 * 1000,      // 1 hour
  drip26w: 60 * 60 * 1000,      // 1 hour
  drip52w: 60 * 60 * 1000,      // 1 hour
  yield: 24 * 60 * 60 * 1000,   // 1 day
  risk: 24 * 60 * 60 * 1000,    // 1 day
  score: 60 * 60 * 1000,        // 1 hour
  signal: 60 * 60 * 1000,       // 1 hour
};

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();

  private generateKey(type: keyof CacheConfig, identifier?: string): string {
    return identifier ? `${type}:${identifier}` : type;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  set<T>(type: keyof CacheConfig, data: T, identifier?: string): void {
    const key = this.generateKey(type, identifier);
    // Get dynamic TTL for price data
    const ttl = type === 'price' ? getPriceTTL() : CACHE_TTLS[type];
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    this.cache.set(key, entry);
  }

  get<T>(type: keyof CacheConfig, identifier?: string): T | null {
    const key = this.generateKey(type, identifier);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(type: keyof CacheConfig, identifier?: string): void {
    const key = this.generateKey(type, identifier);
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  invalidateByPattern(pattern: string): void {
    for (const [key] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // Clean up expired entries
  cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): { totalEntries: number; expiredEntries: number } {
    let expiredCount = 0;
    for (const [, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredCount++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
    };
  }
}

// Global cache instance
export const cache = new CacheService();

// Periodic cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}

// Check if current user is admin (bypass cache)
async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user?.id) return false;
    
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.session.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    return !!data;
  } catch {
    return false;
  }
}

// Cached data fetchers with fallback
export async function getCachedData<T>(
  cacheType: keyof CacheConfig,
  fetcher: () => Promise<T>,
  identifier?: string
): Promise<T> {
  // Always try to get from cache first for all users (including admins)
  const cached = cache.get<T>(cacheType, identifier);
  
  if (cached !== null) {
    console.log(`✅ Using cached ${cacheType} data`);
    
    // For admin users, optionally fetch fresh data in background to update cache
    const isAdmin = await isCurrentUserAdmin();
    if (isAdmin) {
      // Background refresh for admin users (don't await)
      fetcher()
        .then(data => {
          cache.set(cacheType, data, identifier);
          console.log(`🔄 Background refresh completed for ${cacheType}`);
        })
        .catch(error => {
          console.warn(`Background refresh failed for ${cacheType}:`, error);
        });
    }
    
    return cached;
  }

  // No cached data available - fetch new data
  console.log(`📥 Fetching fresh ${cacheType} data (no cache available)`);
  const data = await fetcher();
  
  // Store in cache
  cache.set(cacheType, data, identifier);
  
  return data;
}

// Specific cached fetchers for common use cases
export async function getCachedETFPrices(tickers: string[]) {
  const cacheKey = tickers.sort().join(',');
  
  return getCachedData(
    'price',
    async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // First try the more reliable fetchLivePricesWithDataSources
      try {
        const { fetchLivePricesWithDataSources } = await import('@/lib/live');
        const prices = await fetchLivePricesWithDataSources(tickers);
        
        // Convert LivePrice format to simple price format for caching
        const simplePrices: Record<string, number> = {};
        Object.entries(prices).forEach(([ticker, priceData]) => {
          if (priceData.price > 0) {
            simplePrices[ticker] = priceData.price;
          }
        });
        
        console.log(`✅ Fetched ${Object.keys(simplePrices).length} live prices`);
        return simplePrices;
      } catch (liveError) {
        console.warn('Live price fetch failed, trying fallback quotes function:', liveError);
        
        // Fallback to direct quotes function
        try {
          const { data, error } = await supabase.functions.invoke('quotes', {
            body: { tickers }
          });
          
          if (error) throw new Error(error.message);
          return data?.prices || {};
        } catch (quotesError) {
          console.warn('Quotes function also failed, trying database fallback:', quotesError);
          
          // Final fallback: get prices from database
          const { data: dbPrices, error: dbError } = await supabase
            .from('etfs')
            .select('ticker, current_price')
            .in('ticker', tickers)
            .not('current_price', 'is', null);
          
          if (dbError) throw new Error(`All price sources failed: ${dbError.message}`);
          
          const prices: Record<string, number> = {};
          dbPrices?.forEach((etf: any) => {
            if (etf.current_price > 0) {
              prices[etf.ticker] = etf.current_price;
            }
          });
          
          console.log(`📊 Using database fallback prices for ${Object.keys(prices).length} tickers`);
          return prices;
        }
      }
    },
    cacheKey
  );
}

export async function getCachedETFScoring(preferences: any, country?: string) {
  const cacheKey = `${JSON.stringify(preferences)}-${country || 'all'}`;
  
  return getCachedData(
    'score',
    async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { scoreETFs } = await import('@/lib/scoring');
      
      const { data: rawEtfs, error } = await supabase
        .from('etfs')
        .select('*')
        .eq('active', true)
        .order('ticker');
        
      if (error) throw new Error(error.message);
      
      // Transform raw database ETFs to match ETF type expected by scoreETFs
      const etfs = (rawEtfs || []).map((etf: any) => ({
        ...etf,
        totalReturn1Y: etf.total_return_1y,
        yieldTTM: etf.yield_ttm,
        avgVolume: etf.avg_volume,
        expenseRatio: etf.expense_ratio,
        volatility1Y: etf.volatility_1y,
        maxDrawdown1Y: etf.max_drawdown_1y,
      }));
      
      return scoreETFs(etfs, preferences);
    },
    cacheKey
  );
}

export async function getCachedDividendData(ticker: string) {
  return getCachedData(
    'lastDist',
    async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('dividends')
        .select('*')
        .eq('ticker', ticker)
        .order('ex_date', { ascending: false })
        .limit(12);
        
      if (error) throw new Error(error.message);
      return data || [];
    },
    ticker
  );
}

// Cache warming function for critical data
export async function warmCache() {
  try {
    console.log('Warming cache...');
    
    // Warm up common price data
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: popularETFs } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true)
      .order('aum', { ascending: false })
      .limit(50);
      
    if (popularETFs?.length) {
      const tickers = popularETFs.map(etf => etf.ticker);
      await getCachedETFPrices(tickers);
    }
    
    console.log('Cache warming completed');
  } catch (error) {
    console.error('Cache warming failed:', error);
  }
}