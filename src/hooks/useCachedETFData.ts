import { useQuery } from '@tanstack/react-query';
import { getCachedData, getCachedETFPrices, getCachedETFScoring, getCachedDividendData } from '@/lib/cache';
import { fetchLatestDistributions } from '@/lib/dividends';
import { getETFs } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';

// Custom hooks for cached ETF data with proper React Query integration

export const useCachedETFs = () => {
  return useQuery({
    queryKey: ["cached-etfs"],
    queryFn: async () => {
      return getCachedData('ranking', getETFs, 'all-etfs');
    },
    staleTime: 60_000, // 1 minute
  });
};

export const useCachedPrices = (tickers: string[]) => {
  return useQuery({
    queryKey: ["cached-prices", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      return getCachedETFPrices(tickers);
    },
    enabled: tickers.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: true, // Only refetch on component mount
    refetchInterval: 15 * 60 * 1000, // Auto-refetch every 15 minutes
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
  return useQuery({
    queryKey: ["cached-yields", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      // First, try to get fresh data from database (populated by daily Yahoo Finance updates)
      const cacheKey = `yields-${tickers.sort().join(',')}`;
      
      return getCachedData(
        'yield-1d',
        async () => {
          console.log('🔍 Fetching Yahoo Finance yields for', tickers.length, 'tickers...');
          
          // Call the yfinance function with database update enabled
          const { data, error } = await supabase.functions.invoke('yfinance-yields', {
            body: { 
              tickers: tickers,
              updateDatabase: true 
            }
          });

          if (error) throw error;
          
          console.log('✅ Yahoo Finance yields updated in database:', data?.dbUpdates || 0, 'records');
          return data?.yields || {};
        },
        cacheKey
      );
    },
    enabled: tickers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 1 day
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: 24 * 60 * 60 * 1000, // Auto-refetch every 24 hours
  });
};

export const useCachedScoring = (preferences: any, country?: string) => {
  return useQuery({
    queryKey: ["cached-scoring", JSON.stringify(preferences), country || 'all'],
    queryFn: async () => {
      return getCachedETFScoring(preferences, country);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

export const useCachedDRIP = (tickers: string[]) => {
  return useQuery({
    queryKey: ["cached-drip", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      // Pre-filter tickers that have active ETF records to avoid processing inactive ones
      const { data: activeETFs } = await supabase
        .from('etfs')
        .select('ticker')
        .in('ticker', tickers)
        .eq('active', true);
      
      const activeTickers = activeETFs?.map(etf => etf.ticker) || [];
      
      if (activeTickers.length === 0) return {};
      
      // Batch process in smaller chunks to reduce server load
      const batchSize = 30;
      const batches = [];
      for (let i = 0; i < activeTickers.length; i += batchSize) {
        batches.push(activeTickers.slice(i, i + batchSize));
      }
      
      const results: Record<string, any> = {};
      
      for (const batch of batches) {
        const cacheKey = `drip-${batch.sort().join(',')}`;
        
        try {
          const batchResults = await getCachedData(
            'drip4w',
            async () => {
              console.log('🧮 Fetching DRIP data for', batch.length, 'tickers...');
              const { data, error } = await supabase.functions.invoke('calculate-drip', {
                body: { tickers: batch }
              });
              if (error) throw new Error(error.message);
              return data?.dripData || {};
            },
            cacheKey
          );
          
          Object.assign(results, batchResults);
          console.log('✅ DRIP data loaded:', Object.keys(batchResults || {}).length, 'entries');
        } catch (error) {
          console.error('❌ DRIP batch failed:', error);
          // Continue with other batches on error
        }
      }
      
      return results;
    },
    enabled: tickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
  });
};