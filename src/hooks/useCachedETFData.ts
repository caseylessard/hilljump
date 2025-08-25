import { useQuery } from '@tanstack/react-query';
import { getCachedData, getCachedETFPrices, getCachedETFScoring, getCachedDividendData } from '@/lib/cache';
import { fetchLatestDistributions } from '@/lib/dividends';
import { getETFs } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from './useAdmin';

// Custom hooks for cached ETF data with proper React Query integration

export const useCachedETFs = () => {
  const { isAdmin } = useAdmin();
  
  return useQuery({
    queryKey: ["cached-etfs"],
    queryFn: async () => {
      return getCachedData('ranking', getETFs, 'all-etfs');
    },
    staleTime: isAdmin ? 0 : 60_000, // No cache for admins
    refetchOnMount: isAdmin,
    refetchOnWindowFocus: isAdmin,
  });
};

export const useCachedPrices = (tickers: string[]) => {
  const { isAdmin } = useAdmin();
  
  return useQuery({
    queryKey: ["cached-prices", tickers.sort().join(','), isAdmin ? 'admin' : 'user'],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      return getCachedETFPrices(tickers);
    },
    enabled: tickers.length > 0,
    staleTime: isAdmin ? 0 : 15 * 60 * 1000,
    refetchOnWindowFocus: isAdmin,
    refetchOnMount: true,
    refetchInterval: isAdmin ? false : 15 * 60 * 1000,
  });
};

export const useCachedDistributions = (tickers: string[]) => {
  return useQuery({
    queryKey: ["cached-distributions", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      const cacheKey = tickers.sort().join(',');
      return getCachedData(
        'lastDist',
        () => fetchLatestDistributions(tickers),
        cacheKey
      );
    },
    enabled: tickers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
};

export const useCachedYields = (tickers: string[]) => {
  console.log('🔍 useCachedYields hook called with tickers:', tickers.length);
  
  return useQuery({
    queryKey: ["yields", tickers.slice(0, 5).join(',')], // Use first 5 tickers only for testing
    queryFn: async () => {
      console.log('🔍 Starting Yahoo Finance fetch for tickers:', tickers.slice(0, 5));
      
      if (tickers.length === 0) {
        console.log('❌ No tickers provided');
        return {};
      }
      
      // Test with just a few tickers first
      const testTickers = tickers.slice(0, 5);
      console.log('🔍 Fetching Yahoo Finance yields for', testTickers.length, 'tickers:', testTickers);
      
      try {
        const { data, error } = await supabase.functions.invoke('yfinance-yields', {
          body: { tickers: testTickers }
        });

        if (error) {
          console.error('❌ Yahoo Finance function error:', error);
          return {};
        }
        
        console.log('✅ Yahoo Finance response:', data);
        return data?.yields || {};
      } catch (err) {
        console.error('❌ Yahoo Finance fetch error:', err);
        return {};
      }
    },
    enabled: tickers.length > 0,
    staleTime: 1000, // 1 second for testing
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useCachedScoring = (preferences: any, country?: string) => {
  const { isAdmin } = useAdmin();
  
  return useQuery({
    queryKey: ["cached-scoring", JSON.stringify(preferences), country || 'all', isAdmin ? 'admin' : 'user'],
    queryFn: async () => {
      return getCachedETFScoring(preferences, country);
    },
    staleTime: isAdmin ? 0 : 60 * 60 * 1000,
    refetchOnMount: isAdmin,
    refetchOnWindowFocus: isAdmin,
  });
};

export const useCachedDRIP = (tickers: string[]) => {
  return useQuery({
    queryKey: ["cached-drip", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      console.log('🧮 Loading cached DRIP data for', tickers.length, 'tickers...');
      
      try {
        // First try to get cached DRIP data from database
        const { data, error } = await supabase.functions.invoke('get-cached-drip', {
          body: { tickers }
        });
        
        if (error) {
          console.warn('❌ Failed to fetch cached DRIP data:', error);
          return {};
        }
        
        const cachedResults = data?.dripData || {};
        const foundCount = Object.keys(cachedResults).length;
        const missingTickers = data?.missing || [];
        
        console.log(`✅ Loaded ${foundCount}/${tickers.length} cached DRIP entries`);
        
        // If we have missing tickers and it's a small number, calculate them on-demand
        if (missingTickers.length > 0 && missingTickers.length <= 5) {
          console.log('🔄 Calculating missing DRIP data for:', missingTickers);
          try {
            const { data: liveData, error: liveError } = await supabase.functions.invoke('calculate-drip', {
              body: { tickers: missingTickers }
            });
            
            if (!liveError && liveData?.dripData) {
              Object.assign(cachedResults, liveData.dripData);
              console.log('✅ Added live DRIP data for missing tickers');
            }
          } catch (liveError) {
            console.warn('⚠️ Failed to calculate missing DRIP data:', liveError);
          }
        }
        
        return cachedResults;
        
      } catch (error) {
        console.error('❌ DRIP data fetch failed:', error);
        return {};
      }
    },
    enabled: tickers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - use cached data longer
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on mount - use cached data
  });
};