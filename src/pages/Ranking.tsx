import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MobileETFTable } from '@/components/dashboard/MobileETFTable';

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
  
  // Tab state for tax-free vs tax tables
  const [activeTab, setActiveTab] = useState('taxfree');
  
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: etfs = [], isLoading, error } = useCachedETFs();

  // Get tax country from profile, fallback to Canada for non-authenticated users
  const taxCountry = profile?.country === 'US' ? 'US' : 'CA';

  // Get tickers for data queries - memoized to prevent infinite loops
  const tickers = useMemo(() => etfs.map(e => e.ticker), [etfs]);
  
  // Use stored scores by default for fast loading
  const { data: storedScores = {}, isLoading: scoresLoading } = useCachedStoredScores(tickers, weights, taxCountry);
  const { data: cachedPrices = {}, isLoading: pricesLoading } = useCachedPrices(tickers);
  
  // Tax-free DRIP data (always 0% tax)
  const { data: dripDataTaxFree, isLoading: dripLoadingTaxFree } = useCachedDRIP(tickers, { 
    country: taxCountry, 
    enabled: false, 
    rate: 0 
  });
  
  // For the taxed scenario, we'll calculate it separately with custom logic
  const [dripDataTaxed, setDripDataTaxed] = useState<any>({});
  const [dripLoadingTaxed, setDripLoadingTaxed] = useState(false);
  
  // Calculate taxed DRIP data when tab switches to taxed (for Canadian users and non-authenticated users)
  useEffect(() => {
    if (activeTab === 'taxed' && dripDataTaxFree && Object.keys(dripDataTaxed).length === 0 && (profile?.country === 'CA' || !profile)) {
      setDripLoadingTaxed(true);
      console.log('🏦 Calculating 15% tax impact on US funds...');
      
      const taxedData: any = {};
      
      // Process each ticker's tax-free data and apply 15% tax to US funds only
      Object.entries(dripDataTaxFree).forEach(([ticker, data]: [string, any]) => {
        // Check if this is a US fund (doesn't end with .TO)
        const isUSFund = !ticker.endsWith('.TO');
        
        if (isUSFund && data) {
          // Apply 15% tax reduction to US fund dividends
          const taxMultiplier = 0.85; // 85% after 15% tax
          
          taxedData[ticker] = {
            ...data,
            // Reduce DRIP returns by approximately 15% tax impact on dividends
            drip4wPercent: data.drip4wPercent ? data.drip4wPercent * taxMultiplier : 0,
            drip4wDollar: data.drip4wDollar ? data.drip4wDollar * taxMultiplier : 0,
            drip13wPercent: data.drip13wPercent ? data.drip13wPercent * taxMultiplier : 0,
            drip13wDollar: data.drip13wDollar ? data.drip13wDollar * taxMultiplier : 0,
            drip26wPercent: data.drip26wPercent ? data.drip26wPercent * taxMultiplier : 0,
            drip26wDollar: data.drip26wDollar ? data.drip26wDollar * taxMultiplier : 0,
            drip52wPercent: data.drip52wPercent ? data.drip52wPercent * taxMultiplier : 0,
            drip52wDollar: data.drip52wDollar ? data.drip52wDollar * taxMultiplier : 0,
            taxApplied: '15% on US dividends'
          };
        } else {
          // Canadian funds (.TO) keep original data - no withholding tax
          taxedData[ticker] = {
            ...data,
            taxApplied: 'No tax on Canadian funds'
          };
        }
      });
      
      console.log(`🏦 Applied 15% tax to ${Object.keys(taxedData).filter(t => !t.endsWith('.TO')).length} US funds`);
      console.log(`🍁 No tax applied to ${Object.keys(taxedData).filter(t => t.endsWith('.TO')).length} Canadian funds`);
      
      setDripDataTaxed(taxedData);
      setDripLoadingTaxed(false);
    }
  }, [activeTab, dripDataTaxFree, dripDataTaxed, profile?.country]);

  // Debug DRIP data being passed to table
  useEffect(() => {
    const currentDripData = activeTab === 'taxfree' ? dripDataTaxFree : dripDataTaxed;
    if (currentDripData) {
      console.log(`🎯 Ranking Debug - Passing ${activeTab} data to table:`, {
        dripDataExists: !!currentDripData,
        dripDataKeys: Object.keys(currentDripData).slice(0, 5),
        sampleDripEntry: Object.keys(currentDripData).length > 0 ? 
          { [Object.keys(currentDripData)[0]]: currentDripData[Object.keys(currentDripData)[0]] } : null
      });
    }
  }, [dripDataTaxFree, dripDataTaxed, activeTab]);
  
  // Get RSI signals for trend indicators
  const { data: rsiSignals = {}, isLoading: rsiLoading } = useBulkRSISignals(tickers.slice(0, 50)); // Limit to prevent timeout

  // Helper function to build rankings
  const buildRanking = (etfs: any[], storedScores: any, cachedPrices: any, dripData: any, rsiSignals: any, scenario: string): ScoredETF[] => {
    if (etfs.length === 0) return [];
    
    console.log(`📊 Building ETF rankings for ${scenario} scenario...`);
    
    // Convert stored scores to ScoredETF format
    const scoredETFs: ScoredETF[] = etfs.map(etf => {
      const score = storedScores[etf.ticker];
      const rsiData = rsiSignals[etf.ticker];
      
      // Calculate combined DRIP + RSI trend score
      let combinedScore: number = 0;
      
      // 1. Calculate DRIP position (70% weight)
      let dripPosition = 0;
      const tickerDripData = dripData?.[etf.ticker];
      
      if (tickerDripData) {
        // Extract DRIP percentages (try multiple formats)
        const getDripPercent = (period: string) => {
          // Format 1: Direct period properties
          const percentKey = `drip${period}Percent`;
          if (typeof tickerDripData[percentKey] === 'number') {
            return tickerDripData[percentKey];
          }
          
          // Format 2: Nested period object
          if (tickerDripData[period] && typeof tickerDripData[period].growthPercent === 'number') {
            return tickerDripData[period].growthPercent;
          }
          
          return 0;
        };
        
        const drip4w = getDripPercent('4w');
        const drip13w = getDripPercent('13w'); 
        const drip26w = getDripPercent('26w');
        const drip52w = getDripPercent('52w');
        
        // Convert to per-week returns for Ladder-Delta calculation
        const p4 = drip4w / 4;
        const p13 = drip13w / 13;
        const p26 = drip26w / 26;
        const p52 = drip52w / 52;
        
        // Calculate deltas (recent minus longer period)
        const d1 = p4 - p13;
        const d2 = p13 - p26;
        const d3 = p26 - p52;
        
        // Calculate Ladder-Delta Trend signal score
        const baseScore = 0.60 * p4 + 0.25 * p13 + 0.10 * p26 + 0.05 * p52;
        const positiveDeltaBonus = 1.00 * Math.max(0, d1) + 0.70 * Math.max(0, d2) + 0.50 * Math.max(0, d3);
        const negativeDeltaPenalty = 0.50 * (Math.max(0, -d1) + Math.max(0, -d2) + Math.max(0, -d3));
        
        const ladderDeltaSignalScore = baseScore + positiveDeltaBonus - negativeDeltaPenalty;
        
        // Buy/Sell conditions from scoring logic
        const condBuy = (ladderDeltaSignalScore > 0.005) && (d1 > 0) && (d2 > 0) && (d3 > 0);
        const condSell = (ladderDeltaSignalScore < 0) || (d1 <= 0);
        
        // Determine DRIP position: 1=Buy, 0=Hold, -1=Sell
        if (condBuy) {
          dripPosition = 1;
        } else if (condSell) {
          dripPosition = -1;
        } else {
          dripPosition = 0;
        }
      }
      
      // 2. Calculate RSI position (30% weight)
      let rsiPosition = 0;
      const rsiSignalData = rsiSignals[etf.ticker];
      if (rsiSignalData) {
        const rsiValue = rsiSignalData.rsi || 50; // Default to neutral if no RSI
        
        // Convert RSI to position: <30 = BUY(+1), >70 = SELL(-1), else HOLD(0)
        if (rsiValue < 30) {
          rsiPosition = 1; // Oversold = BUY
        } else if (rsiValue > 70) {
          rsiPosition = -1; // Overbought = SELL
        } else {
          rsiPosition = 0; // Neutral = HOLD
        }
      }
      
      // 3. Calculate combined score: 70% DRIP + 30% RSI
      combinedScore = 0.7 * dripPosition + 0.3 * rsiPosition;
      
      // Convert combined score to position for backward compatibility
      let position: number;
      if (combinedScore >= 0.6) {
        position = 2; // Strong Buy
      } else if (combinedScore >= 0.2) {
        position = 1; // Buy
      } else if (combinedScore >= -0.2) {
        position = 0; // Hold
      } else if (combinedScore >= -0.6) {
        position = -1; // Sell
      } else {
        position = -2; // Strong Sell
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
    
    console.log(`✅ Ranked ${sortedETFs.length} ETFs using stored scores for ${scenario}`);
    return sortedETFs;
  };

  // Create separate rankings for tax-free and taxed scenarios
  const rankedTaxFree: ScoredETF[] = useMemo(() => {
    return buildRanking(etfs, storedScores, cachedPrices, dripDataTaxFree, rsiSignals, 'tax-free');
  }, [etfs, storedScores, cachedPrices, dripDataTaxFree, rsiSignals]);

  const rankedTaxed: ScoredETF[] = useMemo(() => {
    return buildRanking(etfs, storedScores, cachedPrices, dripDataTaxed, rsiSignals, 'taxed');
  }, [etfs, storedScores, cachedPrices, dripDataTaxed, rsiSignals]);

  // Get current ranking based on active tab (default to tax-free, taxed for Canadian users and non-authenticated users)
  const currentRanked = (profile?.country === 'CA' || !profile) && activeTab === 'taxed' ? rankedTaxed : rankedTaxFree;
  
  // Store original rankings with fixed positions based on DRIP score
  const [frozenRankings, setFrozenRankings] = useState<Map<string, number>>(new Map());
  
  // Update frozen rankings when unfiltered rankings change - sort by actual DRIP score
  useEffect(() => {
    if (currentRanked.length > 0) {
      // Create a score-sorted version for frozen rankings
      const scoreBasedRanking = [...currentRanked].sort((a, b) => {
        const getDripSum = (etf: ScoredETF): number => {
          const dripData = ((profile?.country === 'CA' || !profile) && activeTab === 'taxed') ? dripDataTaxed : dripDataTaxFree;
          
          const getDripPercent = (ticker: string, period: '4w' | '13w' | '26w' | '52w'): number => {
            const tickerData = dripData?.[ticker];
            if (tickerData) {
              const percentKey = `drip${period}Percent`;
              if (typeof tickerData[percentKey] === 'number') {
                return tickerData[percentKey];
              }
            }
            return 0;
          };
          
          return getDripPercent(etf.ticker, "4w") + 
                 getDripPercent(etf.ticker, "13w") + 
                 getDripPercent(etf.ticker, "26w") + 
                 getDripPercent(etf.ticker, "52w");
        };
        
        return getDripSum(b) - getDripSum(a); // Highest score first
      });
      
      const newFrozenRankings = new Map<string, number>();
      scoreBasedRanking.forEach((etf, index) => {
        newFrozenRankings.set(etf.ticker, index + 1);
      });
      setFrozenRankings(newFrozenRankings);
    }
  }, [currentRanked, searchQuery, activeTab, profile?.country, dripDataTaxFree, dripDataTaxed]);
  
  const filtered: ScoredETF[] = useMemo(() => {
    // Filter out ETFs with invalid data (dummy prices only)
    let validETFs = currentRanked.filter(etf => {
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
  }, [currentRanked, filter, searchQuery]);

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
      prices: { current: priceCount, total: etfs.length },
      scores: { 
        current: Object.keys(storedScores).length, 
        total: etfs.length 
      }
    }));

    if (priceCount === etfs.length) {
      setLastUpdated(new Date());
    }
  }, [etfs.length, cachedPrices, storedScores]);

  // Save current rankings to database when ranking changes
  useEffect(() => {
    if (currentRanked.length > 50) {
      console.log('📋 Saving current rankings to database');
      saveCurrentRankings(currentRanked.slice(0, 50));
    }
  }, [currentRanked]);

  // Cache the computed ranking data when it updates  
  useEffect(() => {
    if (currentRanked.length > 0) {
      const newState = { 
        weights, 
        filter, 
        cachedRanking: currentRanked.slice(0, 100), // Cache top 100 for performance
        lastRankingUpdate: Date.now(),
        persistentRanking: persistentRanking
      };
      saveCachedState(newState);
    }
  }, [currentRanked, weights, filter, persistentRanking]);

  return (
    <div className="min-h-screen">
      <Navigation />
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 ambient-spotlight pointer-events-none" aria-hidden="true" />
        <div className="container py-8 grid md:grid-cols-[1.2fr,0.8fr] gap-6 items-center">
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Income ETFs</h1>
          </div>
          <div className="flex justify-end gap-2">
            <RefreshDataButton 
              type="both"
              tickers={tickers}
              taxPreferences={{ country: taxCountry, enabled: false, rate: 0 }}
              weights={weights}
              country={taxCountry}
            />
          </div>
        </div>
        
        <div className="container">
          {/* Detailed loading progress tracking */}
          {(isLoading || pricesLoading || scoresLoading || (dripLoadingTaxFree && dripLoadingTaxed) || Object.keys(distributions).length === 0 && etfs.length > 0) && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="text-sm font-medium">Loading ETF Data...</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {isLoading && <div>• Fetching ETF list from database...</div>}
                {pricesLoading && <div>• Loading current prices ({loadingProgress.prices.current}/{loadingProgress.prices.total})</div>}
                {scoresLoading && <div>• Loading scoring data...</div>}
                {(dripLoadingTaxFree || dripLoadingTaxed) && <div>• Calculating DRIP returns...</div>}
                {rsiLoading && <div>• Fetching trend signals...</div>}
                {Object.keys(distributions).length === 0 && etfs.length > 0 && <div>• Loading distribution history...</div>}
                {!isLoading && !pricesLoading && !scoresLoading && !dripLoadingTaxFree && !dripLoadingTaxed && <div>• Finalizing rankings...</div>}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="container grid gap-8 pb-16">
        <section id="ranking" aria-labelledby="ranking-title" className="grid gap-4">
          {/* Tab Navigation - Show for all users, default to Canada behavior for non-authenticated */}
          {(profile?.country === 'CA' || !profile) ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="taxfree">Tax-Free</TabsTrigger>
                <TabsTrigger value="taxed">Taxable</TabsTrigger>
              </TabsList>
              
              <TabsContent value="taxfree" className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Desktop: Filter buttons and Search */}
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

                    <div className="flex items-center gap-2">
                      {(isSubscribed || isAdmin) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowDialog(true)}
                        >
                          Scoring
                        </Button>
                      )}

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by ticker or underlying..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-8 w-64"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
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
                        className="pl-10 pr-8"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="hidden sm:block">
                  <OptimizedETFTable
                    items={filtered} 
                    live={cachedPrices}
                    distributions={distributions}
                    cachedDripData={dripDataTaxFree || {}}
                    rsiSignals={rsiSignals || {}}
                    originalRanking={currentRanked}
                    persistentRanking={persistentRanking}
                    allowSorting={isSubscribed || isAdmin}
                    cachedPrices={cachedPrices}
                    frozenRankings={frozenRankings}
                  />
                </div>
                <div className="block sm:hidden">
                  <MobileETFTable
                    items={filtered}
                    distributions={distributions}
                    cachedDripData={dripDataTaxFree || {}}
                    originalRanking={currentRanked}
                    cachedPrices={cachedPrices}
                    onSelectETF={(etf, rank) => {
                      // Handle ETF selection for mobile detail view if needed
                      console.log('Selected ETF:', etf, 'Rank:', rank);
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="taxed" className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Desktop: Filter buttons and Search */}
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

                    <div className="flex items-center gap-2">
                      {(isSubscribed || isAdmin) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowDialog(true)}
                        >
                          Scoring
                        </Button>
                      )}

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by ticker or underlying..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-8 w-64"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
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
                        className="pl-10 pr-8"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <OptimizedETFTable
                  items={filtered} 
                  live={cachedPrices}
                  distributions={distributions}
                  cachedDripData={dripDataTaxed || {}}
                  rsiSignals={rsiSignals || {}}
                  originalRanking={currentRanked}
                  persistentRanking={persistentRanking}
                  allowSorting={isSubscribed || isAdmin}
                  cachedPrices={cachedPrices}
                  frozenRankings={frozenRankings}
                  taxedScoring={true}
                />
              </TabsContent>
            </Tabs>
          ) : (
            /* US users - no tabs, just tax-free view */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Desktop: Filter buttons and Search */}
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

                  <div className="flex items-center gap-2">
                    {(isSubscribed || isAdmin) && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowDialog(true)}
                      >
                        Scoring
                      </Button>
                    )}

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by ticker or underlying..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-8 w-64"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
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
                      className="pl-10 pr-8"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

          <div className="hidden sm:block">
            <OptimizedETFTable
              items={filtered} 
              live={cachedPrices}
              distributions={distributions}
              cachedDripData={dripDataTaxFree || {}}
              rsiSignals={rsiSignals || {}}
              originalRanking={currentRanked}
              persistentRanking={persistentRanking}
              allowSorting={isSubscribed || isAdmin}
              cachedPrices={cachedPrices}
              frozenRankings={frozenRankings}
            />
          </div>
          <div className="block sm:hidden">
            <MobileETFTable
              items={filtered}
              distributions={distributions}
              cachedDripData={dripDataTaxFree || {}}
              originalRanking={currentRanked}
              cachedPrices={cachedPrices}
              frozenRankings={frozenRankings}
              persistentRanking={persistentRanking}
              onSelectETF={(etf, rank) => {
                // Handle ETF selection for mobile detail view if needed
                console.log('Selected ETF:', etf, 'Rank:', rank);
              }}
            />
          </div>
            </div>
          )}
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
        
        {/* Admin debugging section simplified */}
        {isAdmin && (
          <div className="border-t pt-8">
            <div className="text-center py-4 text-muted-foreground">
              DRIP calculation tools consolidated into admin dashboard
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Ranking;