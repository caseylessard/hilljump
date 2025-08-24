// Cache utility functions and initialization
import { cache, warmCache, CACHE_TTLS } from './cache';

// Initialize cache on app load
let cacheInitialized = false;

export const initializeCache = async () => {
  if (cacheInitialized) return;
  
  try {
    console.log('🚀 Initializing comprehensive cache system...');
    
    // Warm up cache with all essential data types
    await warmSpecificCache('all');
    
    cacheInitialized = true;
    console.log('✅ Cache system initialized successfully with prices, distributions, and DRIP data');
  } catch (error) {
    console.error('❌ Cache initialization failed:', error);
  }
};

// Cache statistics and monitoring
export const getCacheStats = () => {
  const stats = cache.getStats();
  
  return {
    ...stats,
    ttls: CACHE_TTLS,
    hitRate: calculateHitRate(),
    memoryUsage: getMemoryUsage(),
  };
};

// Simple hit rate tracking
let cacheHits = 0;
let cacheMisses = 0;

export const trackCacheHit = () => {
  cacheHits++;
};

export const trackCacheMiss = () => {
  cacheMisses++;
};

const calculateHitRate = () => {
  const total = cacheHits + cacheMisses;
  return total > 0 ? (cacheHits / total) * 100 : 0;
};

const getMemoryUsage = () => {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    return {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize,
      limit: (performance as any).memory.jsHeapSizeLimit,
    };
  }
  return null;
};

// Cache debugging utilities
export const debugCache = () => {
  console.group('🔍 Cache Debug Info');
  console.log('Stats:', getCacheStats());
  console.log('Hit Rate:', `${calculateHitRate().toFixed(2)}%`);
  console.log('Hits:', cacheHits, 'Misses:', cacheMisses);
  console.groupEnd();
};

// Clear cache and reset stats
export const resetCache = () => {
  cache.invalidateAll();
  cacheHits = 0;
  cacheMisses = 0;
  console.log('🧹 Cache cleared and stats reset');
};

// Cache warming for specific data types
export const warmSpecificCache = async (type: 'etfs' | 'prices' | 'yields' | 'distributions' | 'drip' | 'all') => {
  try {
    console.log(`🔥 Warming ${type} cache...`);
    
    switch (type) {
      case 'etfs':
        const { getETFs } = await import('@/lib/db');
        await cache.set('ranking', await getETFs(), 'all-etfs');
        break;
        
      case 'prices':
        await warmCache(); // This already warms price cache
        break;
        
      case 'distributions':
        await warmDistributionsCache();
        break;
        
      case 'drip':
        await warmDripCache();
        break;
        
      case 'yields':
        // Could add yield-specific warming here
        break;
        
      case 'all':
        await warmCache();
        await warmDistributionsCache();
        await warmDripCache();
        break;
    }
    
    console.log(`✅ ${type} cache warmed successfully`);
  } catch (error) {
    console.error(`❌ Failed to warm ${type} cache:`, error);
  }
};

// Warm distributions cache for popular ETFs
const warmDistributionsCache = async () => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { fetchLatestDistributions } = await import('@/lib/dividends');
    
    const { data: popularETFs } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true)
      .order('aum', { ascending: false })
      .limit(50);
      
    if (popularETFs?.length) {
      const tickers = popularETFs.map(etf => etf.ticker);
      await fetchLatestDistributions(tickers); // This caches internally
      console.log('📊 Distributions cache warmed for', tickers.length, 'ETFs');
    }
  } catch (error) {
    console.error('❌ Distributions cache warming failed:', error);
  }
};

// Warm DRIP cache for popular ETFs  
const warmDripCache = async () => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { getCachedData } = await import('@/lib/cache');
    
    const { data: popularETFs } = await supabase
      .from('etfs')
      .select('ticker')
      .eq('active', true)
      .order('aum', { ascending: false })
      .limit(30); // Smaller batch for DRIP due to computation cost
      
    if (popularETFs?.length) {
      const tickers = popularETFs.map(etf => etf.ticker);
      const cacheKey = `drip-warm-${tickers.sort().join(',')}`;
      
      await getCachedData(
        'drip4w',
        async () => {
          const { data, error } = await supabase.functions.invoke('calculate-drip', {
            body: { tickers }
          });
          if (error) throw new Error(error.message);
          return data?.dripData || {};
        },
        cacheKey
      );
      
      console.log('🧮 DRIP cache warmed for', tickers.length, 'ETFs');
    }
  } catch (error) {
    console.error('❌ DRIP cache warming failed:', error);
  }
};