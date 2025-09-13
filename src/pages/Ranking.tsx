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
import { useCachedETFs, useCachedPrices, useCachedDRIP } from '@/hooks/useCachedETFData';
import { useBulkRSISignals } from '@/hooks/useBulkETFData';
import { UserBadge } from '@/components/UserBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type FilterType = 'all' | 'canada' | 'usa' | 'high-yield';

// Simplified ETF type for display
type DisplayETF = {
  ticker: string;
  name: string;
  exchange: string;
  totalReturn1Y?: number;
  yieldTTM?: number;
  expenseRatio?: number;
  volatility1Y?: number;
  maxDrawdown1Y?: number;
  aum?: number;
  current_price?: number;
  category?: string;
  summary?: string;
  compositeScore: number;
  returnScore: number;
  yieldScore: number;
  riskScore: number;
  dripData?: any;
  signal?: any;
};

const Ranking = () => {
  const { toast } = useToast();
  const { profile } = useUserProfile();

  // State management
  const [weights, setWeights] = useState({ return: 60, yield: 25, risk: 15 });
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(15);
  const [taxCountry, setTaxCountry] = useState('CA');
  const [selectedETF, setSelectedETF] = useState<DisplayETF | null>(null);
  const [isETFDialogOpen, setIsETFDialogOpen] = useState(false);
  const [showOptimized, setShowOptimized] = useState(true);

  // Get all ETFs from cache
  const { data: etfs = [], isLoading: etfsLoading, error: etfsError } = useCachedETFs();

  // Set tax preferences based on user profile
  useEffect(() => {
    if (!profile?.country) return;
    
    const isCA = profile?.country === 'CA';
    setTaxEnabled(isCA);
    setTaxRate(isCA ? 15 : 0);
    setTaxCountry(profile.country);
  }, [profile?.country]);

  // Get tickers for data queries
  const tickers = useMemo(() => etfs.map(e => e.ticker), [etfs]);
  
  // Data fetching
  const { data: cachedPrices = {}, isLoading: pricesLoading } = useCachedPrices(tickers);
  const { data: dripData, isLoading: dripLoading } = useCachedDRIP(tickers, { 
    country: taxCountry, 
    enabled: taxEnabled, 
    rate: taxRate / 100 
  });
  const { data: rsiSignals = {}, isLoading: rsiLoading } = useBulkRSISignals(tickers.slice(0, 50));

  // Calculate fresh scores
  const scoredETFs = useMemo(() => {
    if (!etfs.length || pricesLoading || dripLoading) return [];
    
    console.log('🎯 Calculating fresh scores for ranking');
    
    return etfs.map(etf => {
      // Simple scoring calculation
      const returnScore = Math.max(0, (etf.totalReturn1Y || 0) + 0.5);
      const yieldScore = Math.max(0, (etf.yieldTTM || 0) * 10);
      const riskScore = Math.max(0, 1 - (etf.volatility1Y || 0.2));
      
      const compositeScore = 
        (returnScore * weights.return / 100) + 
        (yieldScore * weights.yield / 100) + 
        (riskScore * weights.risk / 100);

      const displayETF: DisplayETF = {
        ...etf,
        compositeScore,
        returnScore,
        yieldScore,
        riskScore,
        current_price: cachedPrices[etf.ticker] || etf.current_price,
        dripData: dripData?.[etf.ticker],
        signal: rsiSignals[etf.ticker] || { signal: 'HOLD', rsi: 50, trend: 'neutral' }
      };
      
      return displayETF;
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, [etfs, cachedPrices, pricesLoading, dripData, dripLoading, rsiSignals, weights]);

  // Filter ETFs
  const filtered = useMemo(() => {
    let result = scoredETFs.filter(etf => {
      const price = etf.current_price || 0;
      return price > 0.01; // Filter out dummy prices
    });

    // Apply country filter
    if (filter === 'canada') {
      result = result.filter(etf => etf.ticker.includes('.TO') || etf.exchange === 'TSX');
    } else if (filter === 'usa') {
      result = result.filter(etf => !etf.ticker.includes('.TO') && etf.exchange !== 'TSX');
    } else if (filter === 'high-yield') {
      result = result.filter(etf => (etf.yieldTTM || 0) > 0.08);
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
  }, [scoredETFs, filter, searchTerm]);

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

  const handleETFClick = useCallback((etf: any) => {
    setSelectedETF(etf);
    setIsETFDialogOpen(true);
  }, []);

  const handleWeightChange = useCallback((newWeights: { return: number; yield: number; risk: number }) => {
    setWeights({
      return: Math.round(newWeights.return * 100),
      yield: Math.round(newWeights.yield * 100), 
      risk: Math.round(newWeights.risk * 100)
    });
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
          {/* Loading indicator */}
          {isLoading && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="text-sm font-medium">Loading ETF Data...</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {etfsLoading && <div>• Fetching ETF list...</div>}
                {pricesLoading && <div>• Loading current prices...</div>}
                {dripLoading && <div>• Calculating DRIP returns...</div>}
                {rsiLoading && <div>• Fetching trend signals...</div>}
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
                        placeholder="Search by ticker, name..."
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
                      <Label>Apply {taxCountry} tax ({taxRate}%)</Label>
                    </div>
                  </div>
                </div>
              </Card>

              <ScoringControls onChange={handleWeightChange} />
              
              <div className="text-center pt-4">
                <UserBadge />
              </div>
            </div>

            {/* Results Area */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-muted-foreground">
                  Showing {filtered.length} ETFs
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

              {/* Simple ETF List */}
              {!isLoading && (
                <div className="space-y-2">
                  {filtered.map((etf, index) => (
                    <Card key={etf.ticker} className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleETFClick(etf)}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{etf.ticker}</div>
                          <div className="text-sm text-muted-foreground truncate">{etf.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${etf.current_price?.toFixed(2) || '—'}</div>
                          <div className="text-sm text-muted-foreground">Score: {etf.compositeScore.toFixed(2)}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
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
                    {selectedETF.yieldTTM ? `${(selectedETF.yieldTTM * 100).toFixed(2)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Expense Ratio</div>
                  <div className="text-lg font-medium">
                    {selectedETF.expenseRatio ? `${(selectedETF.expenseRatio * 100).toFixed(2)}%` : '—'}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ranking;