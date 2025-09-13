import { useQuery, useMutation } from '@tanstack/react-query';
import { getCachedData, getCachedETFPrices, getCachedETFScoring, getCachedDividendData } from '@/lib/cache';
import { 
  getCachedGlobalETFs, 
  getCachedGlobalPrices, 
  getCachedGlobalDistributions,
  getCachedGlobalDRIP,
  getFromGlobalCache,
  refreshDRIPData
} from '@/lib/globalCache';
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
      return getCachedGlobalETFs();
    },
    staleTime: isAdmin ? 0 : 24 * 60 * 60 * 1000, // 1 day for users, stale immediately for admins
    refetchOnMount: false, // Don't auto-refetch on mount
    refetchOnWindowFocus: false // Don't auto-refetch on focus
  });
};

export const useCachedPrices = (tickers: string[]) => {
  const { isAdmin } = useAdmin();
  
  return useQuery<Record<string, any>>({
    queryKey: ["cached-prices", tickers.sort().join(',')],
    queryFn: async (): Promise<Record<string, any>> => {
      if (tickers.length === 0) return {};
      return getCachedGlobalPrices(tickers);
    },
    enabled: tickers.length > 0,
    staleTime: isAdmin ? 0 : 24 * 60 * 60 * 1000, // 1 day for users, stale immediately for admins
    gcTime: 24 * 60 * 60 * 1000, // Keep in memory for 1 day
    refetchOnMount: false, // Don't auto-refetch on mount
    refetchOnWindowFocus: false // Don't auto-refetch on focus
  });
};

export const useCachedDistributions = (tickers: string[]) => {
  return useQuery({
    queryKey: ["cached-distributions", tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      return getCachedGlobalDistributions(tickers);
    },
    enabled: tickers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 1 day cache
    refetchOnMount: false, // Don't auto-refetch on mount
    refetchOnWindowFocus: false // Don't auto-refetch on focus
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

export const useCachedStoredScores = (tickers: string[], weights: any, country = 'CA') => {
  const { isAdmin } = useAdmin();
  
  return useQuery({
    queryKey: ["stored-scores", tickers.sort().join(','), JSON.stringify(weights), country],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      console.log('📊 Loading stored scores for', tickers.length, 'tickers...');
      
      try {
        const { data, error } = await supabase
          .from('etf_scores')
          .select('ticker, composite_score, return_score, yield_score, risk_score, weights, updated_at')
          .in('ticker', tickers)
          .eq('country', country);
        
        if (error) {
          console.warn('❌ Failed to fetch stored scores:', error);
          return {};
        }
        
        const storedScores: Record<string, any> = {};
        data?.forEach(score => {
          storedScores[score.ticker] = {
            compositeScore: score.composite_score,
            returnScore: score.return_score,
            yieldScore: score.yield_score,
            riskScore: score.risk_score,
            weights: score.weights,
            updatedAt: score.updated_at
          };
        });
        
        console.log(`✅ Loaded ${Object.keys(storedScores).length} stored scores`);
        return storedScores;
        
      } catch (error) {
        console.error('❌ Stored scores fetch failed:', error);
        return {};
      }
    },
    enabled: tickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour cache - always use stored data unless very old
    gcTime: 24 * 60 * 60 * 1000, // Keep in memory for 1 day
    placeholderData: (previousData) => previousData, // Show stale data while loading
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const useRefreshScores = () => {
  return useMutation({
    mutationFn: async ({ tickers, weights, country }: { tickers: string[], weights: any, country: string }) => {
      console.log('🔄 Triggering fresh score calculation...');
      
      const { data, error } = await supabase.functions.invoke('hourly-score-updater');
      
      if (error) {
        throw new Error(`Score refresh failed: ${error.message}`);
      }
      
      return data;
    }
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

export const useCachedDRIP = (tickers: string[], taxPreferences?: { country: string, enabled: boolean, rate: number }) => {
  return useQuery({
    queryKey: ["cached-drip", tickers.sort().join(','), JSON.stringify(taxPreferences)],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      
      // Always force fresh calculation when tax preferences are provided
      // This ensures both enabling and disabling tax triggers recalculation
      if (taxPreferences) {
        console.log('🔄 Tax preferences provided, forcing fresh DRIP calculation...', taxPreferences);
        return refreshDRIPData(tickers, taxPreferences);
      }
      
      return getCachedGlobalDRIP(tickers, taxPreferences);
    },
    enabled: tickers.length > 0,
    staleTime: 0, // Always consider data stale so it refetches when tax preferences change
    gcTime: 24 * 60 * 60 * 1000, // Keep in memory for 1 day
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't auto-refetch on focus
    refetchInterval: false, // Don't auto-refresh - only manual refresh
  });
};

export const useRefreshDRIP = () => {
  return useMutation({
    mutationFn: async ({ tickers, taxPreferences }: { tickers: string[], taxPreferences?: any }) => {
      console.log('🔄 Triggering fresh DRIP calculation...');
      
      const { data, error } = await supabase.functions.invoke('hourly-drip-updater');
      
      if (error) {
        throw new Error(`DRIP refresh failed: ${error.message}`);
      }
      
      return data;
    }
  });
};