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
      
      const cacheKey = tickers.sort().join(',');
      return getCachedData(
        'yield',
        async () => {
          try {
            console.log('🔍 Fetching Yahoo Finance yields for', tickers.length, 'tickers...');
            const { data, error } = await supabase.functions.invoke('yfinance-yields', {
              body: { tickers }
            });

            if (error) throw error;
            return data?.yields || {};
          } catch (error) {
            console.error('❌ Yahoo Finance yields failed:', error);
            return {};
          }
        },
        cacheKey
      );
    },
    enabled: tickers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 1 day
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
      
      const cacheKey = tickers.sort().join(',');
      return getCachedData(
        'drip4w',
        async () => {
          const { data, error } = await supabase.functions.invoke('calculate-drip', {
            body: { tickers }
          });
          if (error) throw new Error(error.message);
          return data;
        },
        cacheKey
      );
    },
    enabled: tickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};