import { useState, useEffect } from 'react';
import { getCachedETFPrices, getCachedDividendData } from '@/lib/cache';
import { fetchLivePricesWithDataSources } from '@/lib/live';
import { fetchLatestDistributions } from '@/lib/dividends';
import { useCachedDRIP } from './useCachedETFData';

interface CachedFirstData {
  prices: Record<string, any>;
  distributions: Record<string, any>;
  dripData: Record<string, any>;
  isLoadingLive: boolean;
  lastUpdated: Date | null;
}

/**
 * Hook that loads cached data immediately, then fetches live data in background
 * This provides instant UI feedback while ensuring data freshness
 */
export const useCachedFirstThenLive = (tickers: string[]) => {
  const [data, setData] = useState<CachedFirstData>({
    prices: {},
    distributions: {},
    dripData: {},
    isLoadingLive: false,
    lastUpdated: null
  });

  // Get cached DRIP data using existing hook
  const { data: cachedDripData = {} } = useCachedDRIP(tickers);

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    const loadCachedThenLive = async () => {
      try {
        // Phase 1: Load cached data immediately
        console.log('📥 Loading cached data for', tickers.length, 'tickers...');
        
        const [cachedPrices, cachedDistributions] = await Promise.all([
          getCachedETFPrices(tickers),
          fetchLatestDistributions(tickers) // This uses cache internally
        ]);

        if (cancelled) return;

        // Update state with cached data
        setData(prev => ({
          ...prev,
          prices: cachedPrices || {},
          distributions: cachedDistributions || {},
          dripData: cachedDripData,
          lastUpdated: new Date()
        }));

        console.log('✅ Cached data loaded:', {
          prices: Object.keys(cachedPrices || {}).length,
          distributions: Object.keys(cachedDistributions || {}).length,
          drip: Object.keys(cachedDripData || {}).length
        });

        // Phase 2: Fetch live data in background
        setData(prev => ({ ...prev, isLoadingLive: true }));
        
        console.log('🔄 Fetching live data in background...');
        const livePrices = await fetchLivePricesWithDataSources(tickers);
        
        if (cancelled) return;

        // Update with live data
        setData(prev => ({
          ...prev,
          prices: { ...prev.prices, ...livePrices },
          isLoadingLive: false,
          lastUpdated: new Date()
        }));

        console.log('✅ Live data updated:', Object.keys(livePrices || {}).length, 'prices');

      } catch (error) {
        console.error('❌ Error in cached-first loading:', error);
        if (!cancelled) {
          setData(prev => ({ ...prev, isLoadingLive: false }));
        }
      }
    };

    loadCachedThenLive();

    // Set up periodic refresh (every 5 minutes)
    const refreshInterval = setInterval(() => {
      if (!cancelled) {
        loadCachedThenLive();
      }
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [tickers.join(',')]);

  // Update DRIP data when it changes
  useEffect(() => {
    setData(prev => ({
      ...prev,
      dripData: cachedDripData
    }));
  }, [cachedDripData]);

  return data;
};

/**
 * Simplified hook for just prices with cached-first loading
 */
export const useCachedFirstPrices = (tickers: string[]) => {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    const loadPrices = async () => {
      try {
        // Load cached first
        const cachedPrices = await getCachedETFPrices(tickers);
        if (cancelled) return;
        
        setPrices(cachedPrices || {});
        console.log('📥 Cached prices loaded:', Object.keys(cachedPrices || {}).length);

        // Then fetch live in background
        setIsLoadingLive(true);
        const livePrices = await fetchLivePricesWithDataSources(tickers);
        
        if (cancelled) return;
        
        setPrices(prev => ({ ...prev, ...livePrices }));
        setIsLoadingLive(false);
        console.log('🔄 Live prices updated:', Object.keys(livePrices || {}).length);

      } catch (error) {
        console.error('❌ Price loading error:', error);
        if (!cancelled) setIsLoadingLive(false);
      }
    };

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, [tickers.join(',')]);

  return { prices, isLoadingLive };
};