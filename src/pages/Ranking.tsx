import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { ETFTable } from '@/components/dashboard/ETFTable';
import { OptimizedETFTable } from '@/components/dashboard/OptimizedETFTable';
import { ScoringControls } from '@/components/dashboard/ScoringControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScoredETF, scoreETFs } from '@/lib/scoring';
import { useCachedETFs, useCachedPrices, useCachedDistributions, useCachedDRIP, useCachedStoredScores } from '@/hooks/useCachedETFData';
import { useBulkRSISignals } from '@/hooks/useBulkETFData';
import { Distribution, fetchLatestDistributions } from '@/lib/dividends';
import { saveCurrentRankings } from '@/hooks/useRankingHistory';
import { getETFs } from '@/lib/db';
import { UserBadge } from '@/components/UserBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { LoadingProgress } from '@/components/LoadingProgress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ShowDripWork from '@/components/ShowDripWork';
import { warmGlobalCache } from '@/lib/globalCache';

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
        lastRankingUpdate: parsed.lastRankingUpdate || null,
        persistentRanking: parsed.persistentRanking || [] // New: persistent score-based ranking
      };
    }
  } catch (e) {
    console.warn('Failed to load cached ranking state:', e);
  }
  return {
    weights: { return: 0.6, yield: 0.2, risk: 0.2 },
    filter: "All ETFs",
    cachedRanking: null,
    lastRankingUpdate: null,
    persistentRanking: []
  };
};

const saveCachedState = (state: any) => {
  try {
    localStorage.setItem('ranking-state', JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save ranking state:', e);
  }
};

const cachedState = loadCachedState();

const Ranking = () => {
  const [weights, setWeights] = useState(cachedState.weights);
  const [showDialog, setShowDialog] = useState(false);
  const [distributions, setDistributions] = useState<Record<string, Distribution>>({});
  const [filter, setFilter] = useState<string>(cachedState.filter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cachedRanking, setCachedRanking] = useState<ScoredETF[]>(cachedState.cachedRanking || []);
  const [persistentRanking, setPersistentRanking] = useState(cachedState.persistentRanking || []);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({
    prices: { current: 0, total: 0 },
    distributions: { current: 0, total: 0 },
    scores: { current: 0, total: 0 }
  });
  
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: etfs = [], isLoading, error } = useCachedETFs();
  
  // Warm global cache on first load - disabled, now only on background refresh
  // useEffect(() => {
  //   warmGlobalCache();
  // }, []);

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

  // Get tickers for data queries - memoized to prevent infinite loops
  const tickers = useMemo(() => etfs.map(e => e.ticker), [etfs]);
  
  // Use stored scores by default for fast loading
  const { data: storedScores = {}, isLoading: scoresLoading } = useCachedStoredScores(tickers, weights, taxCountry);
  const { data: cachedPrices = {}, isLoading: pricesLoading } = useCachedPrices(tickers);
  const { data: dripData, isLoading: dripLoading } = useCachedDRIP(tickers, { 
    country: taxCountry, 
    enabled: taxEnabled, 
    rate: taxRate / 100 
  });
  
  // Debug DRIP data loading
  useEffect(() => {
    if (dripData) {
      console.log('💰 DRIP data loaded:', Object.keys(dripData).length, 'tickers');
      console.log('💰 Sample DRIP data:', Object.keys(dripData).slice(0, 3).map(ticker => ({
        ticker,
        data: dripData[ticker]
      })));
      
      // Debug actual data structure
      const sampleTicker = Object.keys(dripData)[0];
      if (sampleTicker) {
        console.log('💰 Sample DRIP structure for', sampleTicker, ':', dripData[sampleTicker]);
      }
    } else if (dripLoading) {
      console.log('⏳ DRIP data loading...');
    } else {
      console.log('❌ No DRIP data available');
    }
  }, [dripData, dripLoading]);
  
  // Get RSI signals for trend indicators
  const { data: rsiSignals = {}, isLoading: rsiLoading } = useBulkRSISignals(tickers.slice(0, 50)); // Limit to prevent timeout
  
  // Debug RSI signals loading  
  useEffect(() => {
    if (rsiSignals && Object.keys(rsiSignals).length > 0) {
      console.log('📈 RSI signals loaded:', Object.keys(rsiSignals).length, 'tickers');
      console.log('📈 Sample RSI signals:', Object.keys(rsiSignals).slice(0, 3).map(ticker => ({
        ticker,
        signal: rsiSignals[ticker]
      })));
    } else if (rsiLoading) {
      console.log('⏳ RSI signals loading...');
    } else if (!rsiLoading) {
      console.log('❌ No RSI signals available, rsiLoading:', rsiLoading);
      console.log('🔍 RSI signals object:', rsiSignals);
    }
  }, [rsiSignals, rsiLoading]);

  const ranked: ScoredETF[] = useMemo(() => {
    if (etfs.length === 0) return [];
    
    console.log('📊 Building ETF rankings from stored scores...');
    
    // Convert stored scores to ScoredETF format
    const scoredETFs: ScoredETF[] = etfs.map(etf => {
      const score = storedScores[etf.ticker];
      const rsiData = rsiSignals[etf.ticker];
      
      // Determine position from RSI signals: 1=BUY, 0=HOLD, -1=SELL
      let position: number | undefined;
      if (rsiData?.position !== undefined) {
        position = rsiData.position;
      } else if (rsiData?.signal) {
        // Fallback: convert signal string to position number
        switch (rsiData.signal.toLowerCase()) {
          case 'buy': position = 1; break;
          case 'sell': position = -1; break;
          case 'hold': position = 0; break;
          default: position = undefined;
        }
      }
      
      return {
        ...etf,
        compositeScore: score?.compositeScore || 0,
        returnScore: score?.returnScore || 0,
        yieldScore: score?.yieldScore || 0,
        riskScore: score?.riskScore || 0,
        current_price: cachedPrices[etf.ticker] || etf.current_price,
        dripData: dripData?.[etf.ticker],
        position: position // Add position for trend indicators
      };
    });

    // Sort by composite score (highest first)
    const sortedETFs = scoredETFs.sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0));
    
    // Check if we have valid scores (non-zero)
    const hasValidScores = sortedETFs.some(etf => (etf.compositeScore || 0) > 0);
    
    if (hasValidScores) {
      // Update persistent ranking only when we have valid scores
      const newPersistentRanking = sortedETFs.map((etf, index) => ({
        ticker: etf.ticker,
        rank: index + 1,
        score: etf.compositeScore || 0,
        updatedAt: Date.now()
      }));
      
      const newState = {
        ...cachedState,
        persistentRanking: newPersistentRanking,
        lastRankingUpdate: Date.now()
      };
      saveCachedState(newState);
      
      console.log(`✅ Updated persistent ranking with ${newPersistentRanking.length} valid scores`);
    } else {
      console.log('📋 Using existing persistent ranking - no valid scores found');
    }
    
    console.log(`✅ Ranked ${sortedETFs.length} ETFs using stored scores with RSI positions`);
    return sortedETFs;
  }, [etfs, storedScores, cachedPrices, dripData, rsiSignals, cachedState]);

  
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

  // Load distributions separately (prices now handled by hook)
  useEffect(() => {
    if (!tickers.length) return;
    let cancelled = false;

    const loadDistributions = async () => {
      try {
        console.log('📦 Loading distributions...');
        
        const distributionsData = await fetchLatestDistributions(tickers);
        
        if (cancelled) return;
        
        setDistributions(distributionsData);
        const distCount = Object.keys(distributionsData).length;
        setLoadingProgress(prev => ({
          ...prev,
          distributions: { current: distCount, total: tickers.length }
        }));
        console.log('✅ Loaded distributions:', distCount);

      } catch (e) {
        console.warn('Failed to load distributions:', e);
      }
    };

    loadDistributions();
    return () => { cancelled = true; };
  }, [tickers]);

  // Update loading progress when prices are loaded
  useEffect(() => {
    if (!etfs.length) return;
    
    const priceCount = Object.keys(cachedPrices).length;
    setLoadingProgress(prev => ({
      ...prev,
      prices: { current: priceCount, total: etfs.length }
    }));
    
    if (priceCount > 0) {
      console.log('✅ Prices loaded via hook:', priceCount);
    }
  }, [cachedPrices, etfs.length]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Ranking Debug:', {
      cachedPricesKeys: Object.keys(cachedPrices),
      cachedPricesCount: Object.keys(cachedPrices).length,
      sampleCachedPrice: cachedPrices['YBTC'] || cachedPrices['AAPW'],
      filteredCount: filtered.length,
      sampleTicker: filtered[0]?.ticker
    });
  }, [cachedPrices, filtered]);

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
          <div className="flex justify-end">
            <RefreshDataButton 
              type="both"
              tickers={tickers}
              taxPreferences={{ country: taxCountry, enabled: taxEnabled, rate: taxRate / 100 }}
              weights={weights}
              country={taxCountry}
            />
          </div>
        </div>
        
        <div className="container">
          <LoadingProgress 
            etfsLoading={isLoading}
            pricesLoading={pricesLoading}
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

          <OptimizedETFTable 
            items={filtered} 
            live={cachedPrices}
            distributions={distributions}
            cachedDripData={dripData || {}}
            rsiSignals={rsiSignals || {}}
            originalRanking={ranked}
            persistentRanking={persistentRanking}
            allowSorting={isSubscribed || isAdmin}
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