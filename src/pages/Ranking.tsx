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
import { useCachedETFs, useCachedPrices, useCachedDistributions, useCachedDRIP } from '@/hooks/useCachedETFData';
import { Distribution, fetchLatestDistributions } from '@/lib/dividends';
import { saveCurrentRankings } from '@/hooks/useRankingHistory';
import { getETFs } from '@/lib/db';
import { UserBadge } from '@/components/UserBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import { LoadingProgress } from '@/components/LoadingProgress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ShowDripWork from '@/components/ShowDripWork';

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
  const [cachedPrices, setCachedPrices] = useState<Record<string, any>>({});
  const [distributions, setDistributions] = useState<Record<string, Distribution>>({});
  const [filter, setFilter] = useState<string>(cachedState.filter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cachedRanking, setCachedRanking] = useState<ScoredETF[]>(cachedState.cachedRanking || []);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({
    prices: { current: 0, total: 0 },
    distributions: { current: 0, total: 0 },
    scores: { current: 0, total: 0 }
  });
  
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: etfs = [], isLoading, error } = useQuery({ 
    queryKey: ["etfs"], 
    queryFn: getETFs, 
    staleTime: 60_000 
  });

  // Get tax country from profile, fallback to US
  const taxCountry = profile?.country === 'CA' ? 'CA' : 'US';
  
  // Tax preference state - for US users, always 0% tax and hidden controls
  const [taxEnabled, setTaxEnabled] = useState(taxCountry === 'CA');
  const [taxRate, setTaxRate] = useState(taxCountry === 'CA' ? 15 : 0);

  // Update tax preferences when profile country changes
  useEffect(() => {
    const isCA = profile?.country === 'CA';
    setTaxEnabled(isCA);
    setTaxRate(isCA ? 15 : 0);
  }, [profile?.country]);

  // Get tickers for DRIP data
  const tickers = etfs.map(e => e.ticker);
  const { data: dripData } = useCachedDRIP(tickers, { 
    country: taxCountry, 
    enabled: taxEnabled, 
    rate: taxRate / 100 
  });

  const ranked: ScoredETF[] = useMemo(() => {
    if (etfs.length === 0) return [];
    
    // Determine which price data to use (cached prices only since we removed livePrices)
    const priceData = cachedPrices;
    
    // Always recalculate when DRIP data changes to ensure tax preference updates
    // Use cached ranking if it's recent, no new price data, and no DRIP data changes
    const now = Date.now();
    const cacheAge = cachedState.lastRankingUpdate ? now - cachedState.lastRankingUpdate : Infinity;
    const isCacheRecent = cacheAge < 15 * 60 * 1000; // 15 minutes
    const hasNewPriceData = Object.keys(priceData).length > 0;
    const hasDripData = dripData && Object.keys(dripData).length > 0;
    
    // Only use cached ranking if no DRIP data is available (prevents stale rankings)
    if (isCacheRecent && !hasNewPriceData && !hasDripData && cachedRanking.length > 0) {
      return cachedRanking;
    }
    
    // Score with available price and DRIP data
    return scoreETFs(etfs, weights, priceData, dripData || {});
  }, [etfs, weights, cachedPrices, cachedRanking, dripData]);

  
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
        
        // Set initial progress
        setLoadingProgress(prev => ({
          ...prev,
          prices: { current: 0, total: tickers.length },
          distributions: { current: 0, total: tickers.length }
        }));

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
          const priceCount = Object.keys(cachedPricesData.value).length;
          setLoadingProgress(prev => ({
            ...prev,
            prices: { current: priceCount, total: tickers.length }
          }));
          console.log('✅ Loaded cached prices:', priceCount);
        }
        
        if (cachedDripData.status === 'fulfilled') {
          console.log('✅ Loaded cached DRIP data:', Object.keys(cachedDripData.value).length);
        }
        
        if (distributionsData.status === 'fulfilled') {
          setDistributions(distributionsData.value);
          const distCount = Object.keys(distributionsData.value).length;
          setLoadingProgress(prev => ({
            ...prev,
            distributions: { current: distCount, total: tickers.length }
          }));
          console.log('✅ Loaded distributions:', distCount);
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
        
        // Set initial progress for live data
        setLoadingProgress(prev => ({
          ...prev,
          prices: { current: 0, total: tickers.length },
          scores: { current: 0, total: tickers.length }
        }));
        
        // 1. Fetch live prices
        const { getCachedETFPrices } = await import('@/lib/cache');
        const liveData = await getCachedETFPrices(tickers);
        
        if (cancelled) return;
        const liveCount = Object.keys(liveData).length;
        setLoadingProgress(prev => ({
          ...prev,
          prices: { current: liveCount, total: tickers.length }
        }));
        console.log(`✅ Updated ${liveCount} live prices`);
        
        // 2. Recalculate DRIP with live prices
        console.log('🧮 Recalculating DRIP with live prices...');
        const { supabase } = await import('@/integrations/supabase/client');
        
        const batchSize = 30;
        const batches = [];
        for (let i = 0; i < tickers.length; i += batchSize) {
          batches.push(tickers.slice(i, i + batchSize));
        }
        
        const newDripData: Record<string, any> = {};
        let processedCount = 0;
        
        for (const batch of batches) {
          if (cancelled) break;
          
            try {
              const { data, error } = await supabase.functions.invoke('calculate-drip', {
                body: { 
                  tickers: batch,
                  livePrices: Object.fromEntries(
                    batch.map(ticker => [ticker, liveData[ticker]]).filter(([, price]) => price)
                  ),
                  taxPrefs: {
                    country: taxCountry,
                    withholdingTax: taxEnabled,
                    taxRate: taxRate // Already in percentage format
                  }
                }
              });
            
            if (error) throw new Error(error.message);
            Object.assign(newDripData, data?.dripData || {});
            processedCount += batch.length;
            setLoadingProgress(prev => ({
              ...prev,
              scores: { current: processedCount, total: tickers.length }
            }));
            console.log(`✅ Recalculated DRIP for ${batch.length} tickers`);
          } catch (error) {
            console.warn('Failed to recalculate DRIP batch:', error);
          }
        }
        
        if (cancelled) return;
        console.log('✅ Recalculated DRIP for all tickers');
        
        // 3. Write updated data back to cache
        console.log('💾 Writing updated data to cache...');
        const { cache } = await import('@/lib/cache');
        
        // Cache the live prices
        cache.set('price', liveData, tickers.sort().join(','));
        
        // Cache the new DRIP data
        cache.set('drip4w', newDripData, tickers.sort().join(','));
        
        console.log('✅ Cache updated successfully');
        setLastUpdated(new Date());
        
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
  }, [etfs, taxCountry, taxEnabled, taxRate]);

  // Cache the ranking when it changes (after live data calculations)
  useEffect(() => {
    if (etfs.length > 0 && ranked.length > 0) {
      setCachedRanking(ranked);
      
      // Also save to cache service and database for historical tracking
      const saveRankingToCache = async () => {
        try {
          const { cache } = await import('@/lib/cache');
          cache.set('ranking', ranked, 'live-calculated');
          console.log('💾 Saved updated ranking to cache');

          // Save to database for historical tracking (only once per day)
          const lastSaveKey = 'ranking-last-saved-date';
          const today = new Date().toISOString().split('T')[0];
          const lastSaved = localStorage.getItem(lastSaveKey);
          
          if (lastSaved !== today) {
            await saveCurrentRankings(ranked);
            localStorage.setItem(lastSaveKey, today);
            console.log('📊 Saved current rankings to database for historical tracking');
          }
        } catch (e) {
          console.warn('Failed to cache ranking:', e);
        }
      };
      
      saveRankingToCache();
    }
  }, [ranked, etfs.length]);

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
            lastUpdated={lastUpdated}
            pricesProgress={loadingProgress.prices}
            distributionsProgress={loadingProgress.distributions}
            scoresProgress={loadingProgress.scores}
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
              
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by ticker or underlying..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                
                {/* Tax Preferences - only show for Canadian users */}
                {taxCountry === 'CA' && (
                  <div className="flex items-center gap-3 px-3 py-2 border rounded-lg bg-background">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="tax-enabled"
                        checked={taxEnabled}
                        onCheckedChange={(checked) => {
                          setTaxEnabled(checked);
                          if (!checked) setTaxRate(0);
                          else setTaxRate(15);
                        }}
                      />
                      <Label htmlFor="tax-enabled" className="text-sm">Withholding Tax</Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                        className="w-16 h-7 text-xs text-center"
                        min="0"
                        max="100"
                        step="0.1"
                        disabled={!taxEnabled}
                      />
                      <Label className="text-xs text-muted-foreground">%</Label>
                    </div>
                  </div>
                )}
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
              
              {/* Tax Preferences - only show for Canadian users */}
              {taxCountry === 'CA' && (
                <div className="flex items-center gap-3 px-3 py-2 border rounded-lg bg-background">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="tax-enabled-mobile"
                      checked={taxEnabled}
                      onCheckedChange={(checked) => {
                        setTaxEnabled(checked);
                        if (!checked) setTaxRate(0);
                        else setTaxRate(15);
                      }}
                    />
                    <Label htmlFor="tax-enabled-mobile" className="text-sm">Withholding Tax</Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                      className="w-16 h-7 text-xs text-center"
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={!taxEnabled}
                    />
                    <Label className="text-xs text-muted-foreground">%</Label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ETFTable 
            items={filtered} 
            live={cachedPrices}
            distributions={distributions}
            cachedDripData={dripData || {}}
            originalRanking={ranked}
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
        
        {/* DRIP Calculation Test - temporary for debugging */}
        {isAdmin && (
          <div className="border-t pt-8">
            <ShowDripWork />
          </div>
        )}
      </main>
    </div>
  );
};

export default Ranking;