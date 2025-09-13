import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { ETFTable } from '@/components/dashboard/ETFTable';
import { OptimizedETFTable } from '@/components/dashboard/OptimizedETFTable';

import { ScoringControls } from '@/components/dashboard/ScoringControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScoredETF, scoreETFsWithPrefs } from '@/lib/scoring';
import { RankingPrefs } from '@/lib/rankingPresets';
import { useCachedETFs, useCachedPrices, useCachedDistributions, useCachedDRIP } from '@/hooks/useCachedETFData';
import { useBulkRSISignals } from '@/hooks/useBulkETFData';
import { Distribution, fetchLatestDistributions } from '@/lib/dividends';
import { saveCurrentRankings } from '@/hooks/useRankingHistory';
import { getETFs } from '@/lib/db';
import { UserBadge } from '@/components/UserBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import { RefreshDataButton } from '@/components/RefreshDataButton';
// Removed deleted components - functionality consolidated
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
// ShowDripWork component removed
import { warmGlobalCache } from '@/lib/globalCache';

type FilterType = 'all' | 'canada' | 'usa' | 'high-yield';

// Load cached state from localStorage
const loadCachedState = () => {
  try {
    const cached = localStorage.getItem('etf-ranking-state');
    return cached ? JSON.parse(cached) : {
      weights: { return: 15, yield: 25, risk: 20, dividendStability: 20, period4w: 8, period52w: 2, homeCountryBias: 6 },
      filter: 'all' as FilterType,
      searchTerm: '',
      taxEnabled: false,
      taxRate: 15,
      taxCountry: 'CA',
      persistentRanking: []
    };
  } catch (error) {
    console.warn('Failed to load cached state:', error);
    return {
      weights: { return: 15, yield: 25, risk: 20, dividendStability: 20, period4w: 8, period52w: 2, homeCountryBias: 6 },
      filter: 'all' as FilterType,
      searchTerm: '',
      taxEnabled: false,
      taxRate: 15,
      taxCountry: 'CA',
      persistentRanking: []
    };
  }
};

// Save state to localStorage with throttling
let saveTimeout: NodeJS.Timeout;
const saveCachedState = (state: any) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem('etf-ranking-state', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save cached state:', error);
    }
  }, 500);
};

const Ranking = () => {
  const { toast } = useToast();
  const { profile } = useUserProfile();

  // Initialize state from cache
  const [cachedState, setCachedState] = useState(() => loadCachedState());
  const [weights, setWeights] = useState(cachedState.weights);
  const [filter, setFilter] = useState<FilterType>(cachedState.filter);
  const [searchTerm, setSearchTerm] = useState(cachedState.searchTerm);
  const [taxEnabled, setTaxEnabled] = useState(cachedState.taxEnabled);
  const [taxRate, setTaxRate] = useState(cachedState.taxRate);
  const [taxCountry, setTaxCountry] = useState(cachedState.taxCountry);
  const [loadingProgress, setLoadingProgress] = useState({ prices: { current: 0, total: 0 } });
  const [selectedETF, setSelectedETF] = useState<ScoredETF | null>(null);
  const [isETFDialogOpen, setIsETFDialogOpen] = useState(false);
  const [showOptimized, setShowOptimized] = useState(true); // Default to optimized view

  // Save state changes to cache
  useEffect(() => {
    const state = {
      weights,
      filter,
      searchTerm,
      taxEnabled,
      taxRate,
      taxCountry,
      persistentRanking: cachedState.persistentRanking
    };
    setCachedState(state);
    saveCachedState(state);
  }, [weights, filter, searchTerm, taxEnabled, taxRate, taxCountry, cachedState.persistentRanking]);

  // Get all ETFs from cache
  const { data: etfs = [], isLoading: etfsLoading, error: etfsError } = useCachedETFs();

  // Set tax preferences based on user profile
  useEffect(() => {
    if (!profile?.country) return;
    
    const isCA = profile?.country === 'CA';
    setTaxEnabled(isCA);
    setTaxRate(isCA ? 15 : 0);
  }, [profile?.country]);

  // Get tickers for data queries - memoized to prevent infinite loops
  const tickers = useMemo(() => etfs.map(e => e.ticker), [etfs]);
  
  // Use fresh calculations for accurate data
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

  // Calculate fresh scores using the same system as AI Portfolio
  const scoredETFs = useMemo(() => {
    if (!etfs.length || pricesLoading || dripLoading) return [];
    
    console.log('🎯 Using fresh calculations for ranking display');
    
    // Convert weights to RankingPrefs format (using presets)
    const rankingPrefs: RankingPrefs = {
      drip_4w: weights.period4w / 100,
      drip_52w: weights.period52w / 100,
      home_country_bias: weights.homeCountryBias / 100,
      tax_enabled: taxEnabled,
      tax_rate: taxRate / 100,
      country: taxCountry as 'US' | 'CA'
    };
    
    // Use the same scoring system as AI Portfolio
    const freshScores = scoreETFsWithPrefs(etfs, rankingPrefs, cachedPrices, dripData);
    
    // Convert to the format expected by the UI and add RSI signals
    return freshScores.map(scored => ({
      ...scored,
      // Map the fresh score properties to expected UI properties
      returnScore: scored.returnNorm,
      yieldScore: scored.yieldNorm, 
      riskScore: scored.riskScore,
      current_price: cachedPrices[scored.ticker] || scored.current_price,
      dripData: dripData?.[scored.ticker],
      signal: rsiSignals[scored.ticker] || { signal: 'HOLD', rsi: 50, trend: 'neutral' }
    }));
  }, [etfs, cachedPrices, pricesLoading, dripData, dripLoading, weights, taxEnabled, taxRate, taxCountry, rsiSignals]);

  const ranked: ScoredETF[] = useMemo(() => {
    return scoredETFs; // Already sorted by composite score from scoreETFsWithPrefs
  }, [scoredETFs]);

  
  const filtered: ScoredETF[] = useMemo(() => {
    // Filter out ETFs with invalid data (dummy prices only)
    const validETFs = ranked.filter(etf => {
      const price = etf.current_price || 0;
      return price > 0.01; // Filter out dummy prices
    });

    let result = validETFs;

    // Apply country filter
    if (filter === 'canada') {
      result = result.filter(etf => etf.ticker.includes('.TO') || etf.country === 'CA');
    } else if (filter === 'usa') {
      result = result.filter(etf => !etf.ticker.includes('.TO') && etf.country !== 'CA');
    } else if (filter === 'high-yield') {
      result = result.filter(etf => (etf.yieldTTM || 0) > 0.08); // 8%+ yield
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(etf => 
        etf.ticker.toLowerCase().includes(term) ||
        etf.name.toLowerCase().includes(term) ||
        (etf.category && etf.category.toLowerCase().includes(term))
      );
    }

    return result;
  }, [ranked, filter, searchTerm]);

  // Distribution data
  const [distributions, setDistributions] = useState<Record<string, Distribution[]>>({});
  const { data: cachedDistributions = {}, isLoading: distributionsLoading } = useCachedDistributions(tickers);
  
  useEffect(() => {
    setDistributions(cachedDistributions);
  }, [cachedDistributions]);

  // Loading state
  const isLoading = etfsLoading || pricesLoading || dripLoading || rsiLoading;

  // Error handling
  if (etfsError) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading ETFs</h1>
          <p className="text-muted-foreground">{etfsError.message}</p>
        </div>
      </div>
    );
  }

  const handleETFClick = useCallback((etf: ScoredETF) => {
    setSelectedETF(etf);
    setIsETFDialogOpen(true);
  }, []);

  const handleWeightChange = useCallback((newWeights: any) => {
    setWeights(newWeights);
  }, []);

  const resetWeights = useCallback(() => {
    const defaultWeights = { return: 15, yield: 25, risk: 20, dividendStability: 20, period4w: 8, period52w: 2, homeCountryBias: 6 };
    setWeights(defaultWeights);
  }, []);

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
              type="drip"
              tickers={tickers}
              taxPreferences={{ country: taxCountry, enabled: taxEnabled, rate: taxRate / 100 }}
            />
          </div>
        </div>
        
        <div className="container">
          {/* Detailed loading progress tracking */}
          {(isLoading || pricesLoading || dripLoading || Object.keys(distributions).length === 0 && etfs.length > 0) && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="text-sm font-medium">Loading ETF Data...</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {isLoading && <div>• Fetching ETF list from database...</div>}
                {pricesLoading && <div>• Loading current prices ({loadingProgress.prices.current}/{loadingProgress.prices.total})</div>}
                {dripLoading && <div>• Calculating DRIP returns...</div>}
                {rsiLoading && <div>• Fetching trend signals...</div>}
                {Object.keys(distributions).length === 0 && etfs.length > 0 && <div>• Loading distribution history...</div>}
                {!isLoading && !pricesLoading && !dripLoading && <div>• Finalizing rankings...</div>}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-[300px,1fr] gap-6">
            {/* Controls Sidebar */}
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Filters & Search</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="search">Search ETFs</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="search"
                        placeholder="Search by ticker, name, or category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Filter by Region</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['all', 'canada', 'usa', 'high-yield'].map((f) => (
                        <Badge
                          key={f}
                          variant={filter === f ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setFilter(f as FilterType)}
                        >
                          {f === 'all' ? 'All ETFs' :
                           f === 'canada' ? 'Canada' :
                           f === 'usa' ? 'USA' :
                           'High Yield 8%+'}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Tax Settings</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={taxEnabled}
                        onCheckedChange={setTaxEnabled}
                      />
                      <Label>Apply {taxCountry} withholding tax ({taxRate}%)</Label>
                    </div>
                  </div>
                </div>
              </Card>

              <ScoringControls
                weights={weights}
                onWeightsChange={handleWeightChange}
                onReset={resetWeights}
                showDripControls={true}
              />
              
              <div className="text-center pt-4">
                <UserBadge />
              </div>
            </div>

            {/* Results Area */}
            <div>
              {/* View Toggle */}
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-muted-foreground">
                  Showing {filtered.length} of {ranked.length} ETFs
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="optimized-toggle" className="text-sm">Optimized View</Label>
                  <Switch
                    id="optimized-toggle"
                    checked={showOptimized}
                    onCheckedChange={setShowOptimized}
                  />
                </div>
              </div>

              {/* ETF Table */}
              {showOptimized ? (
                <OptimizedETFTable
                  etfs={filtered}
                  distributions={distributions}
                  onETFClick={handleETFClick}
                  isLoading={isLoading}
                  persistentRanking={cachedState.persistentRanking}
                />
              ) : (
                <ETFTable
                  etfs={filtered}
                  distributions={distributions}
                  onETFClick={handleETFClick}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ETF Details Dialog */}
      <Dialog open={isETFDialogOpen} onOpenChange={setIsETFDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedETF?.name} ({selectedETF?.ticker})
            </DialogTitle>
          </DialogHeader>
          {selectedETF && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Current Price</div>
                  <div className="text-lg font-medium">
                    ${selectedETF.current_price?.toFixed(2) || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Yield (TTM)</div>
                  <div className="text-lg font-medium">
                    {selectedETF.yield_ttm ? `${(selectedETF.yield_ttm * 100).toFixed(2)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Expense Ratio</div>
                  <div className="text-lg font-medium">
                    {selectedETF.expense_ratio ? `${(selectedETF.expense_ratio * 100).toFixed(2)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">AUM</div>
                  <div className="text-lg font-medium">
                    {selectedETF.aum ? `$${(selectedETF.aum / 1_000_000).toFixed(0)}M` : '—'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">Description</div>
                <p className="text-sm">{selectedETF.summary || 'No description available.'}</p>
              </div>

              {selectedETF.dripData && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">DRIP Performance</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium">4 Week</div>
                      <div className="text-green-600">
                        {selectedETF.dripData.period_4w?.growthPercent?.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">13 Week</div>
                      <div className="text-green-600">
                        {selectedETF.dripData.period_13w?.growthPercent?.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">26 Week</div>
                      <div className="text-green-600">
                        {selectedETF.dripData.period_26w?.growthPercent?.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">52 Week</div>
                      <div className="text-green-600">
                        {selectedETF.dripData.period_52w?.growthPercent?.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ranking;