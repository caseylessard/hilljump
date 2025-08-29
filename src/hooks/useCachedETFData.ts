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
      
      console.log('🏃‍♂️ Fetching prices for', tickers.length, 'tickers...');
      
      // Step 1: Get database prices immediately (show cached prices on load)
      const { data: dbPrices, error: dbError } = await supabase
        .from('etfs')
        .select('ticker, current_price, price_updated_at')
        .in('ticker', tickers)
        .not('current_price', 'is', null);
      
      if (dbError) {
        console.error('❌ Failed to fetch database prices:', dbError);
      }
      
      // Convert database prices to expected format
      const results: Record<string, any> = {};
      dbPrices?.forEach(etf => {
        if (etf.current_price && etf.current_price > 0) {
          results[etf.ticker] = {
            price: etf.current_price,
            source: 'database',
            priceUpdatedAt: etf.price_updated_at
          };
        }
      });
      
      console.log(`📊 Loaded ${Object.keys(results).length} prices from database`);
      
      // Step 2: Fetch live prices in background and update database
      if (!isAdmin) {
        // For regular users, start background fetch but return database prices immediately
        setTimeout(async () => {
          try {
            console.log('🔄 Background: Fetching live prices...');
            const { data: liveData, error: liveError } = await supabase.functions.invoke('quotes', {
              body: { tickers }
            });
            
            if (!liveError && liveData?.prices) {
              console.log(`✅ Background: Got ${Object.keys(liveData.prices).length} live prices`);
            }
          } catch (error) {
            console.warn('⚠️ Background price fetch failed:', error);
          }
        }, 100); // Small delay to return database prices first
      } else {
        // For admins, fetch live prices immediately
        try {
          console.log('🔄 Admin: Fetching live prices immediately...');
          const { data: liveData, error: liveError } = await supabase.functions.invoke('quotes', {
            body: { tickers }
          });
          
          if (!liveError && liveData?.prices) {
            // Merge live prices into results, overriding database prices
            Object.entries(liveData.prices).forEach(([ticker, price]) => {
              if (typeof price === 'number' && price > 0) {
                results[ticker] = {
                  price,
                  source: 'live',
                  priceUpdatedAt: new Date().toISOString()
                };
              }
            });
            console.log(`✅ Admin: Updated with ${Object.keys(liveData.prices).length} live prices`);
          }
        } catch (error) {
          console.warn('⚠️ Live price fetch failed for admin:', error);
        }
      }
      
      return results;
    },
    enabled: tickers.length > 0,
    staleTime: isAdmin ? 0 : 5 * 60 * 1000, // 5 minutes for users, immediate for admins
    refetchOnWindowFocus: isAdmin,
    refetchOnMount: true,
    refetchInterval: isAdmin ? false : 10 * 60 * 1000, // 10 minutes for background refresh
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
    staleTime: isAdmin ? 0 : 5 * 60 * 1000, // 5 minutes cache for users
    refetchOnMount: isAdmin,
    refetchOnWindowFocus: isAdmin,
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
        // Get cached DRIP data from the appropriate country-specific table
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
        const userCountry = data?.userCountry || 'US';
        
        console.log(`✅ Loaded ${foundCount}/${tickers.length} cached DRIP entries (country: ${userCountry})`);
        
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