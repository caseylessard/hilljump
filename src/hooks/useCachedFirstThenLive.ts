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
 * Hook that loads data progressively in the order requested:
 * 1. ticker, score, cached price
 * 2. last distribution
 * 3. next distribution
 * 4. yield
 * 5. live price (final update)
 */
export const useProgressiveDataLoad = (tickers: string[], weights: any) => {
  const [data, setData] = useState<{
    etfs: any[];
    scores: Record<string, number>;
    cachedPrices: Record<string, any>;
    lastDistributions: Record<string, any>;
    nextDistributions: Record<string, any>;
    yields: Record<string, number>;
    livePrices: Record<string, any>;
    loadingStage: 'tickers' | 'distributions' | 'next-dist' | 'yields' | 'live' | 'complete';
    lastUpdated: Date | null;
  }>({
    etfs: [],
    scores: {},
    cachedPrices: {},
    lastDistributions: {},
    nextDistributions: {},
    yields: {},
    livePrices: {},
    loadingStage: 'tickers',
    lastUpdated: null
  });

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    const loadProgressively = async () => {
      try {
        // Stage 1: Load tickers, scores, and cached prices
        console.log('📊 Stage 1: Loading tickers, scores, and cached prices...');
        setData(prev => ({ ...prev, loadingStage: 'tickers' }));

        const [etfs, cachedPrices] = await Promise.all([
          (async () => {
            const { getETFs } = await import('@/lib/db');
            return await getETFs();
          })(),
          getCachedETFPrices(tickers)
        ]);

        if (cancelled) return;

        // Calculate scores with cached data
        const { scoreETFs } = await import('@/lib/scoring');
        const scored = scoreETFs(etfs, weights, cachedPrices);
        const scores = Object.fromEntries(
          scored.map(etf => [etf.ticker, etf.compositeScore])
        );

        setData(prev => ({
          ...prev,
          etfs: scored,
          scores,
          cachedPrices: cachedPrices || {},
          lastUpdated: new Date()
        }));

        console.log('✅ Stage 1 complete:', Object.keys(cachedPrices || {}).length, 'cached prices');

        // Stage 2: Load last distributions
        console.log('📊 Stage 2: Loading last distributions...');
        setData(prev => ({ ...prev, loadingStage: 'distributions' }));

        const { fetchLatestDistributions } = await import('@/lib/dividends');
        const lastDistributions = await fetchLatestDistributions(tickers);

        if (cancelled) return;

        setData(prev => ({
          ...prev,
          lastDistributions: lastDistributions || {},
          lastUpdated: new Date()
        }));

        console.log('✅ Stage 2 complete:', Object.keys(lastDistributions || {}).length, 'distributions');

        // Stage 3: Load next distributions (predict from patterns)
        console.log('📊 Stage 3: Loading next distributions...');
        setData(prev => ({ ...prev, loadingStage: 'next-dist' }));

        const nextDistributions = Object.fromEntries(
          await Promise.all(
            Object.entries(lastDistributions || {}).map(async ([ticker, dist]: [string, any]) => {
              const { predictNextDistribution } = await import('@/lib/dividends');
              const next = predictNextDistribution(dist);
              return [ticker, next];
            })
          )
        );

        if (cancelled) return;

        setData(prev => ({
          ...prev,
          nextDistributions,
          lastUpdated: new Date()
        }));

        console.log('✅ Stage 3 complete:', Object.keys(nextDistributions).length, 'predicted distributions');

        // Stage 4: Load yields (from ETF data)
        console.log('📊 Stage 4: Loading yields...');
        setData(prev => ({ ...prev, loadingStage: 'yields' }));

        const yields = Object.fromEntries(
          etfs.map(etf => [etf.ticker, etf.yieldTTM || 0])
        );

        if (cancelled) return;

        setData(prev => ({
          ...prev,
          yields,
          lastUpdated: new Date()
        }));

        console.log('✅ Stage 4 complete:', Object.keys(yields).length, 'yields');

        // Stage 5: Load live prices (final update)
        console.log('📊 Stage 5: Loading live prices...');
        setData(prev => ({ ...prev, loadingStage: 'live' }));

        const livePrices = await fetchLivePricesWithDataSources(tickers);

        if (cancelled) return;

        // Recalculate scores with live prices
        const finalScored = scoreETFs(etfs, weights, livePrices);
        const finalScores = Object.fromEntries(
          finalScored.map(etf => [etf.ticker, etf.compositeScore])
        );

        setData(prev => ({
          ...prev,
          etfs: finalScored,
          scores: finalScores,
          livePrices: livePrices || {},
          loadingStage: 'complete',
          lastUpdated: new Date()
        }));

        console.log('✅ Stage 5 complete: Live prices loaded and scores updated');

      } catch (error) {
        console.error('❌ Progressive loading error:', error);
        if (!cancelled) {
          setData(prev => ({ ...prev, loadingStage: 'complete' }));
        }
      }
    };

    loadProgressively();

    return () => {
      cancelled = true;
    };
  }, [tickers.join(','), JSON.stringify(weights)]);

  return data;
};

/**
 * Legacy hook for backward compatibility - loads cached data immediately, then fetches live data
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
        console.log('📥 Loading cached data for', tickers.length, 'tickers...');
        
        const [cachedPrices, cachedDistributions] = await Promise.all([
          getCachedETFPrices(tickers),
          fetchLatestDistributions(tickers)
        ]);

        if (cancelled) return;

        setData(prev => ({
          ...prev,
          prices: cachedPrices || {},
          distributions: cachedDistributions || {},
          dripData: cachedDripData,
          lastUpdated: new Date()
        }));

        // Fetch live data in background
        setData(prev => ({ ...prev, isLoadingLive: true }));
        const livePrices = await fetchLivePricesWithDataSources(tickers);
        
        if (cancelled) return;

        setData(prev => ({
          ...prev,
          prices: { ...prev.prices, ...livePrices },
          isLoadingLive: false,
          lastUpdated: new Date()
        }));

      } catch (error) {
        console.error('❌ Error in cached-first loading:', error);
        if (!cancelled) {
          setData(prev => ({ ...prev, isLoadingLive: false }));
        }
      }
    };

    loadCachedThenLive();

    return () => {
      cancelled = true;
    };
  }, [tickers.join(',')]);

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