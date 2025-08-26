import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { ETFTable } from '@/components/dashboard/ETFTable';
import { ScoringControls } from '@/components/dashboard/ScoringControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScoredETF, scoreETFs } from '@/lib/scoring';
import { fetchLivePricesWithDataSources, LivePrice } from '@/lib/live';
import { Distribution, fetchLatestDistributions } from '@/lib/dividends';
import { getETFs } from '@/lib/db';
import { UserBadge } from '@/components/UserBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import { LoadingProgress } from '@/components/LoadingProgress';

type FilterType = 'all' | 'canada' | 'usa' | 'high-yield';

// Load cached state from localStorage
const loadCachedState = () => {
  try {
    const cached = localStorage.getItem('ranking-state');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        weights: parsed.weights || { return: 0.6, yield: 0.2, risk: 0.2 },
        filter: parsed.filter || "All ETFs",
        cachedRanking: parsed.cachedRanking || null,
        lastRankingUpdate: parsed.lastRankingUpdate || null
      };
    }
  } catch (e) {
    console.warn('Failed to load cached ranking state:', e);
  }
  return {
    weights: { return: 0.6, yield: 0.2, risk: 0.2 },
    filter: "All ETFs",
    cachedRanking: null,
    lastRankingUpdate: null
  };
};

const cachedState = loadCachedState();

const Ranking = () => {
  const [weights, setWeights] = useState(cachedState.weights);
  const [showDialog, setShowDialog] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});
  const [cachedPrices, setCachedPrices] = useState<Record<string, any>>({});
  const [distributions, setDistributions] = useState<Record<string, Distribution>>({});
  const [dripData, setDripData] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState<string>(cachedState.filter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cachedRanking, setCachedRanking] = useState<ScoredETF[]>(cachedState.cachedRanking || []);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: etfs = [], isLoading, error } = useQuery({ 
    queryKey: ["etfs"], 
    queryFn: getETFs, 
    staleTime: 60_000 
  });

  const ranked: ScoredETF[] = useMemo(() => {
    if (etfs.length === 0) return [];
    
    // Determine which price data to use (live prices override cached prices)
    const priceData = Object.keys(livePrices).length > 0 ? livePrices : cachedPrices;
    
    // Use cached ranking if it's recent and no new price data
    const now = Date.now();
    const cacheAge = cachedState.lastRankingUpdate ? now - cachedState.lastRankingUpdate : Infinity;
    const isCacheRecent = cacheAge < 15 * 60 * 1000; // 15 minutes
    const hasNewPriceData = Object.keys(priceData).length > 0;
    
    if (isCacheRecent && !hasNewPriceData && cachedRanking.length > 0) {
      return cachedRanking;
    }
    
    // Score with available price and DRIP data
    return scoreETFs(etfs, weights, priceData, dripData);
  }, [etfs, weights, livePrices, cachedPrices, cachedRanking]);

  
  const filtered: ScoredETF[] = useMemo(() => {
    // Filter out ETFs with invalid data (dummy prices only)
    let validETFs = ranked.filter(etf => {
      // Exclude ETFs with clearly invalid data
      if (etf.current_price === 50.0) return false; // Remove $50 dummy prices
      return true;
    });
    
    // Apply category filter using reliable country field
    if (filter === "US Funds") {
      validETFs = validETFs.filter(e => e.country === 'US');
    } else if (filter === "Canadian Funds") {
      validETFs = validETFs.filter(e => e.country === 'CA');
    }
    // "All ETFs" doesn't need additional filtering
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      validETFs = validETFs.filter(etf => 
        etf.ticker.toLowerCase().includes(query) ||
        (etf.underlying && etf.underlying.toLowerCase().includes(query)) ||
        (etf.name && etf.name.toLowerCase().includes(query))
      );
    }
    
    return validETFs;
  }, [ranked, filter, searchQuery]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) { 
        setIsSubscribed(false); 
        setIsAdmin(false); 
        return; 
      }
      
      const [{ data: sub }, { data: roles }] = await Promise.all([
        supabase.from('subscribers').select('subscribed').eq('user_id', uid).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', uid)
      ]);
      
      setIsSubscribed(Boolean((sub as any)?.subscribed));
      setIsAdmin(Array.isArray(roles) && roles.some((r: any) => String(r.role).toLowerCase() === 'admin'));
    })();
  }, []);

  useEffect(() => {
    document.title = "HillJump — Top Income ETFs";
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'HillJump quick reference: All high-yield dividend ETFs ranked by risk-aware total return.');
  }, []);

  // Load all cached data immediately on mount
  useEffect(() => {
    if (!etfs.length) return;
    let cancelled = false;

    const loadCachedData = async () => {
      try {
        const tickers = etfs.map(e => e.ticker);
        console.log('📦 Loading cached data for immediate display...');

        // Load all cached data in parallel
        const [cachedPricesData, cachedDripData, distributionsData] = await Promise.allSettled([
          import('@/lib/cache').then(({ cache }) => cache.get('price', tickers.sort().join(',')) || {}),
          import('@/lib/cache').then(({ cache }) => cache.get('drip4w', tickers.sort().join(',')) || {}),
          fetchLatestDistributions(tickers)
        ]);

        if (cancelled) return;

        // Set cached data for immediate display
        if (cachedPricesData.status === 'fulfilled') {
          setCachedPrices(cachedPricesData.value);
          console.log('✅ Loaded cached prices:', Object.keys(cachedPricesData.value).length);
        }
        
        if (cachedDripData.status === 'fulfilled') {
          setDripData(cachedDripData.value);
          console.log('✅ Loaded cached DRIP data:', Object.keys(cachedDripData.value).length);
        }
        
        if (distributionsData.status === 'fulfilled') {
          setDistributions(distributionsData.value);
          console.log('✅ Loaded distributions:', Object.keys(distributionsData.value).length);
        }

      } catch (e) {
        console.warn('Failed to load cached data:', e);
      }
    };

    loadCachedData();
    return () => { cancelled = true; };
  }, [etfs]);

  // Load live prices and recalculate after cached data is shown
  useEffect(() => {
    if (!etfs.length) return;
    let cancelled = false;

    const loadLiveDataAndRecalculate = async () => {
      try {
        setIsLoadingLive(true);
        const tickers = etfs.map(e => e.ticker);
        
        console.log('🔄 Loading live prices and recalculating...');
        
        // 1. Fetch live prices
        const { getCachedETFPrices } = await import('@/lib/cache');
        const liveData = await getCachedETFPrices(tickers);
        
        if (cancelled) return;
        setLivePrices(liveData);
        console.log(`✅ Updated ${Object.keys(liveData).length} live prices`);
        
        // 2. Recalculate DRIP with live prices
        console.log('🧮 Recalculating DRIP with live prices...');
        const { supabase } = await import('@/integrations/supabase/client');
        
        const batchSize = 30;
        const batches = [];
        for (let i = 0; i < tickers.length; i += batchSize) {
          batches.push(tickers.slice(i, i + batchSize));
        }
        
        const newDripData: Record<string, any> = {};
        for (const batch of batches) {
          if (cancelled) break;
          
          try {
            const { data, error } = await supabase.functions.invoke('calculate-drip', {
              body: { 
                tickers: batch,
                livePrices: Object.fromEntries(
                  batch.map(ticker => [ticker, liveData[ticker]]).filter(([, price]) => price)
                )
              }
            });
            
            if (error) throw new Error(error.message);
            Object.assign(newDripData, data?.dripData || {});
            console.log(`✅ Recalculated DRIP for ${batch.length} tickers`);
          } catch (error) {
            console.warn('Failed to recalculate DRIP batch:', error);
          }
        }
        
        if (cancelled) return;
        setDripData(newDripData);
        
        // 3. Write updated data back to cache
        console.log('💾 Writing updated data to cache...');
        const { cache } = await import('@/lib/cache');
        
        // Cache the live prices
        cache.set('price', liveData, tickers.sort().join(','));
        
        // Cache the new DRIP data
        cache.set('drip4w', newDripData, tickers.sort().join(','));
        
        console.log('✅ Cache updated successfully');
        
      } catch (e) {
        console.warn('Live data update failed, keeping cached data:', e);
      } finally {
        setIsLoadingLive(false);
      }
    };

    // Delay live data loading to show cached data first
    const liveDataTimeout = setTimeout(loadLiveDataAndRecalculate, 500);
    
    // Then refresh periodically
    const refreshInterval = setInterval(loadLiveDataAndRecalculate, 5 * 60 * 1000); // 5 minutes
    
    return () => { 
      cancelled = true; 
      clearTimeout(liveDataTimeout);
      clearInterval(refreshInterval);
    };
  }, [etfs]);

  // Cache the ranking when it changes (after live data calculations)
  useEffect(() => {
    if (etfs.length > 0 && ranked.length > 0 && Object.keys(livePrices).length > 0) {
      setCachedRanking(ranked);
      
      // Also save to cache service
      const saveRankingToCache = async () => {
        try {
          const { cache } = await import('@/lib/cache');
          cache.set('ranking', ranked, 'live-calculated');
          console.log('💾 Saved updated ranking to cache');
        } catch (e) {
          console.warn('Failed to cache ranking:', e);
        }
      };
      
      saveRankingToCache();
    }
  }, [ranked, etfs.length, livePrices]);

  // Save state to localStorage whenever weights, filter, or ranking changes
  useEffect(() => {
    try {
      const stateToSave = {
        weights,
        filter,
        cachedRanking,
        lastRankingUpdate: Date.now()
      };
      localStorage.setItem('ranking-state', JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save ranking state to localStorage:', e);
    }
  }, [weights, filter, cachedRanking]);

  return (
    <div className="min-h-screen">
      <Navigation />
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 ambient-spotlight pointer-events-none" aria-hidden="true" />
        <div className="container py-8 grid md:grid-cols-[1.2fr,0.8fr] gap-6 items-center">
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Income ETFs</h1>
          </div>
        </div>
        
        <div className="container">
          <LoadingProgress 
            etfsLoading={isLoading}
            pricesLoading={isLoadingLive && Object.keys(cachedPrices).length === 0}
            distributionsLoading={Object.keys(distributions).length === 0 && etfs.length > 0}
            scoresLoading={ranked.length === 0 && etfs.length > 0}
            yieldsLoading={false}
          />
        </div>
      </header>

      <main className="container grid gap-8 pb-16">
        <section id="ranking" aria-labelledby="ranking-title" className="grid gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Desktop: Buttons left, Search right */}
            <div className="hidden sm:flex items-center justify-between w-full gap-4">
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={filter === "All ETFs" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("All ETFs")}
                  className="h-8"
                >
                  All ETFs
                </Button>
                <Button
                  variant={filter === "US Funds" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("US Funds")}
                  className="h-8"
                >
                  US Funds
                </Button>
                <Button
                  variant={filter === "Canadian Funds" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("Canadian Funds")}
                  className="h-8"
                >
                  Canadian Funds
                </Button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ticker or underlying..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
            
            {/* Mobile: Dropdown and Search */}
            <div className="flex sm:hidden flex-col gap-2 w-full">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background shadow-lg">
                  <SelectItem value="All ETFs">All ETFs</SelectItem>
                  <SelectItem value="US Funds">US Funds</SelectItem>
                  <SelectItem value="Canadian Funds">Canadian Funds</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ticker or underlying..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <ETFTable 
            items={filtered} 
            live={Object.keys(livePrices).length > 0 ? livePrices : cachedPrices}
            distributions={distributions}
            cachedDripData={dripData}
          />
        </section>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Scoring Settings</DialogTitle>
            </DialogHeader>
            {(isSubscribed || isAdmin) ? (
              <ScoringControls onChange={setWeights} />
            ) : (
              <div className="text-sm text-muted-foreground">Subscribe to access scoring settings.</div>
            )}
          </DialogContent>
        </Dialog>

        <p className="text-muted-foreground text-xs">Not investment advice.</p>
      </main>
    </div>
  );
};

export default Ranking;