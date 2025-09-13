import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useBulkETFData, useBulkRSISignals } from "@/hooks/useBulkETFData";
import { useCachedPrices, useCachedDRIP, useCachedStoredScores } from "@/hooks/useCachedETFData";
import { useUserProfile } from "@/hooks/useUserProfile";
import { scoreETFsWithPrefs } from "@/lib/scoring";
import { buildAIPortfolio, type AIPortfolioETF, type WeightingMethod, type ScoreSource } from "@/lib/aiPortfolio";
import Navigation from "@/components/Navigation";
import { RefreshButton } from "@/components/RefreshButton";
import { TrendingUp, DollarSign, Globe, Building2, Zap, PieChart } from "lucide-react";

const Portfolio = () => {
  // Get user profile for country-specific data
  const { profile } = useUserProfile();
  
  // AI Portfolio preferences
  const [preferences, setPreferences] = useState({
    topK: 10,                          // Number of ETFs to select
    scoreSource: "blend" as ScoreSource,   // trend, ret1y, or blend
    weighting: "return" as WeightingMethod, // equal, return, or risk_parity
    maxWeight: 0.25,                   // Maximum weight per ETF (25%)
    minTradingDays: 60                // Minimum trading history required (reduced for better coverage)
  });

  const [portfolioSize, setPortfolioSize] = useState(10000); // $10k default
  const [selectedETFs, setSelectedETFs] = useState<AIPortfolioETF[]>([]);

  // First get all available ETF tickers
  const { data: allTickersData = [] } = useQuery({
    queryKey: ["all-etf-tickers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etfs')
        .select('ticker')
        .eq('active', true);
      
      if (error) throw error;
      return data?.map(row => row.ticker) || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour cache
  });

  // Fetch bulk ETF data using same source as optimized table
  const { data: etfData = {}, isLoading: etfsLoading } = useBulkETFData(allTickersData);
  
  // Get cached prices and DRIP data (same as Rankings page)
  const { data: cachedPrices = {}, isLoading: pricesLoading } = useCachedPrices(allTickersData);
  const { data: cachedDripData = {}, isLoading: dripLoading } = useCachedDRIP(allTickersData);
  
  // Get stored scores using same system as Rankings page
  const { data: storedScores = {} } = useCachedStoredScores(
    allTickersData, 
    { return: 15, yield: 25, risk: 20 }, // Default weights
    profile?.country || 'CA'
  );
  
  // Get RSI signals for trend calculations (same as Rankings page)  
  const { data: rsiSignals = {} } = useBulkRSISignals(allTickersData.slice(0, 50)); // Limit to prevent timeout
  
  // Convert to ETF format compatible with AI portfolio - using real ranking scores
  const etfs = useMemo(() => {
    return Object.values(etfData).filter((etf: any) => {
      // Filter out ETFs with bad or test data
      if (!etf.ticker || ['TEST', 'DEMO', 'SAMPLE'].some(test => etf.ticker.includes(test))) {
        return false;
      }
      
      // Filter out ETFs with unrealistic yields (likely bad data) - max 50% annual yield
      if (etf.yield_ttm && etf.yield_ttm > 50) {
        console.warn(`Filtering out ${etf.ticker} due to unrealistic yield: ${etf.yield_ttm}%`);
        return false;
      }
      
      // Filter out ETFs with missing essential data
      if (!etf.current_price || etf.current_price <= 0) {
        return false;
      }
      
      return true;
    }).map((etf: any) => {
      // Get the stored score for this ETF (same as Rankings page)
      const score = storedScores[etf.ticker];
      const rsiData = rsiSignals[etf.ticker];
      
      // Calculate trend score using same logic as Rankings page
      let combinedScore = 0;
      let dripPosition = 0;
      const tickerDripData = cachedDripData?.[etf.ticker];
      
      if (tickerDripData) {
        // Extract DRIP percentages (same logic as Rankings)
        const getDripPercent = (period: string) => {
          const percentKey = `drip${period}Percent`;
          if (typeof tickerDripData[percentKey] === 'number') {
            return tickerDripData[percentKey];
          }
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
      
      // Calculate RSI position (30% weight)
      let rsiPosition = 0;
      if (rsiData) {
        const rsiValue = rsiData.rsi || 50;
        if (rsiValue < 30) {
          rsiPosition = 1; // Oversold = BUY
        } else if (rsiValue > 70) {
          rsiPosition = -1; // Overbought = SELL
        } else {
          rsiPosition = 0; // Neutral = HOLD
        }
      }
      
      // Calculate combined score: 70% DRIP + 30% RSI
      combinedScore = 0.7 * dripPosition + 0.3 * rsiPosition;
      
      // Calculate position based on combined score (same as Rankings page)
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
        totalReturn1Y: etf.total_return_1y,
        yieldTTM: etf.yield_ttm,
        avgVolume: etf.avg_volume,
        expenseRatio: etf.expense_ratio,
        volatility1Y: etf.volatility_1y,
        maxDrawdown1Y: etf.max_drawdown_1y,
        current_price: etf.current_price,
        strategyLabel: etf.strategy_label,
        logoKey: etf.logo_key,
        dataSource: etf.data_source,
        polygonSupported: etf.polygon_supported,
        twelveSymbol: etf.twelve_symbol,
        eodhSymbol: etf.eodhd_symbol,
        // Add ranking score data - only composite_score is real, others are defaults
        compositeScore: score?.composite_score || 0,
        returnScore: score?.return_score || 0,
        yieldScore: score?.yield_score || 0,
        riskScore: score?.risk_score || 0,
        // Real calculated values from DRIP+RSI logic (not stored defaults)
        trendScore: position, // Use calculated position as trend mark (-2 to +2)
        ret1yScore: score?.composite_score || 0, // Use real composite_score, not default return_score
        position: position // Real calculated position from DRIP+RSI
      };
    });
  }, [etfData, storedScores, cachedDripData, rsiSignals]);

  // SEO setup
  useEffect(() => {
    document.title = "AI Portfolio Builder — HillJump";
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'Build an optimized ETF portfolio with AI-driven recommendations based on performance, diversification, and geographic preferences.');
  }, []);

  // State to hold the resolved portfolio results
  const [resolvedPortfolio, setResolvedPortfolio] = useState<AIPortfolioETF[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Effect to build portfolio - with stable dependencies to prevent loops
  useEffect(() => {
    let isCancelled = false;
    
    const buildPortfolio = async () => {
      if (etfs.length === 0 || !cachedPrices || Object.keys(cachedPrices).length === 0) return;
      
      setPortfolioLoading(true);
      try {
        // Filter out low-quality ETFs before building portfolio
        const qualityETFs = etfs.filter(etf => {
          // Exclude known poor performers and test tickers
          const lowQualityTickers = ['FIAT', 'TEST', 'DEMO'];
          if (lowQualityTickers.includes(etf.ticker)) return false;
          
          // Must have yield data
          if (!etf.yieldTTM || etf.yieldTTM <= 0) return false;
          
          // Must have current price
          if (!etf.current_price || etf.current_price <= 0) return false;
          
          // Must have reasonable yield (not extreme outliers)
          if (etf.yieldTTM > 100) return false; // Over 100% yield is suspicious
          
          return true;
        });
        
        console.log(`🔍 Filtered ${etfs.length} ETFs down to ${qualityETFs.length} quality ETFs`);
        
        // Pass DRIP data to the AI portfolio builder
        const result = await buildAIPortfolio(qualityETFs, cachedPrices || {}, {
          topK: preferences.topK,
          minTradingDays: preferences.minTradingDays,
          scoreSource: preferences.scoreSource,
          weighting: preferences.weighting,
          maxWeight: preferences.maxWeight,
          capital: portfolioSize,
          roundShares: true
        }, cachedDripData || {});
        
        if (!isCancelled) {
          setResolvedPortfolio(result);
        }
      } catch (error) {
        console.error('Error building AI portfolio:', error);
        if (!isCancelled) {
          setResolvedPortfolio([]);
        }
      } finally {
        if (!isCancelled) {
          setPortfolioLoading(false);
        }
      }
    };

    buildPortfolio();
    
    return () => {
      isCancelled = true;
    };
  }, [etfs, cachedPrices, cachedDripData, preferences.topK, preferences.scoreSource, preferences.weighting, preferences.maxWeight, preferences.minTradingDays, portfolioSize]);

  // Portfolio allocations are now calculated within the AI portfolio builder
  const totalAllocation = resolvedPortfolio.reduce((sum, item) => sum + (item.weight * 100), 0);
  const totalSpent = resolvedPortfolio.reduce((sum, item) => sum + (item.allocRounded || 0), 0);
  const cashLeft = portfolioSize - totalSpent;

  // Export portfolio to CSV
  const exportToCSV = () => {
    if (resolvedPortfolio.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const csvData = [
      ['Ticker', 'Name', 'Exchange', 'Category', 'Weight %', 'Allocation $', 'Shares', 'Price', 'Trend Score', 'Return Score', 'Badge', 'Badge Label'],
      ...resolvedPortfolio.map(etf => [
        etf.ticker,
        etf.name,
        etf.exchange,
        etf.category || '',
        (etf.weight * 100).toFixed(2),
        (etf.allocationDollar || 0).toFixed(2),
        etf.shares || 0,
        etf.lastPrice.toFixed(2),
        etf.trendScore.toFixed(1),
        etf.ret1yScore.toFixed(1),
        etf.badge || '',
        etf.badgeLabel || ''
      ])
    ];

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ai-portfolio-${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <header className="container py-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">AI Portfolio Builder</h1>
          </div>
          <RefreshButton />
        </div>
        <p className="text-lg text-muted-foreground">
          Build an AI-optimized ETF portfolio using Ladder-Delta Trend scoring, 1-year returns, and advanced risk metrics.
        </p>
      </header>

      <main className="container grid lg:grid-cols-[1fr,2fr] gap-8 pb-16">
        {/* Controls Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                AI Portfolio Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Portfolio Size */}
              <div>
                <label className="text-sm font-medium mb-2 block">Portfolio Size</label>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={portfolioSize}
                    onChange={(e) => setPortfolioSize(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border rounded-md"
                    min="1000"
                    step="1000"
                  />
                </div>
              </div>

              <Separator />

              {/* Top K ETFs */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Number of ETFs</label>
                  <Badge variant="secondary">{preferences.topK}</Badge>
                </div>
                <Slider
                  value={[preferences.topK]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, topK: value }))}
                  min={3}
                  max={20}
                  step={1}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Select top-performing ETFs for your portfolio</p>
              </div>

              {/* Score Source */}
              <div>
                <label className="text-sm font-medium mb-2 block">Scoring Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['trend', 'ret1y', 'blend'] as ScoreSource[]).map(method => (
                    <Button
                      key={method}
                      variant={preferences.scoreSource === method ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreferences(p => ({ ...p, scoreSource: method }))}
                    >
                      {method === 'trend' ? 'Trend' : method === 'ret1y' ? '1Y Return' : 'Blend'}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Trend: Ladder-Delta momentum • 1Y Return: Annual performance • Blend: 70% trend + 30% return
                </p>
              </div>

              {/* Weighting Method */}
              <div>
                <label className="text-sm font-medium mb-2 block">Weighting Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['equal', 'return', 'risk_parity'] as WeightingMethod[]).map(method => (
                    <Button
                      key={method}
                      variant={preferences.weighting === method ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreferences(p => ({ ...p, weighting: method }))}
                    >
                      {method === 'equal' ? 'Equal' : method === 'return' ? 'Return' : 'Risk'}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Equal: 1/K weight • Return: Weight by performance • Risk: Inverse volatility
                </p>
              </div>

              {/* Max Weight */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Max Weight per ETF</label>
                  <Badge variant="secondary">{(preferences.maxWeight * 100).toFixed(0)}%</Badge>
                </div>
                <Slider
                  value={[preferences.maxWeight * 100]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, maxWeight: value / 100 }))}
                  min={10}
                  max={50}
                  step={5}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Maximum allocation to any single ETF</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Results */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Portfolio Recommendations</CardTitle>
              <p className="text-sm text-muted-foreground">
                {resolvedPortfolio.length} positions • ${portfolioSize.toLocaleString()} • ${totalSpent.toLocaleString()} allocated • ${cashLeft.toLocaleString()} cash
              </p>
              {resolvedPortfolio.some(etf => etf.isEstimated) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-orange-800">
                    ⚠️ Some ETFs use estimated data due to insufficient historical prices. 
                    These are heavily penalized in scoring but may still appear if few alternatives exist.
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {etfsLoading || portfolioLoading || pricesLoading || dripLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Building AI portfolio...</p>
                </div>
              ) : resolvedPortfolio.length > 0 ? (
                <div className="space-y-4">
                  {resolvedPortfolio.map((etf, index) => (
                    <div key={etf.ticker} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{etf.ticker}</Badge>
                          <span className="font-medium text-sm">{etf.name}</span>
                          {etf.badge && (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                etf.badgeColor === 'green' ? 'bg-emerald-100 text-emerald-800' :
                                etf.badgeColor === 'red' ? 'bg-red-100 text-red-800' :
                                etf.badgeColor === 'orange' ? 'bg-orange-100 text-orange-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {etf.badge}
                            </Badge>
                          )}
                          {etf.isEstimated && (
                            <Badge variant="destructive" className="text-xs">
                              ⚠️ Estimated
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {etf.category} • Trend: {etf.trendScore.toFixed(1)} • Return: {etf.ret1yScore.toFixed(1)}
                        </p>
                        {etf.badgeLabel && (
                          <p className="text-xs text-muted-foreground">{etf.badgeLabel}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{(etf.weight * 100).toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">
                          ${(etf.allocRounded || 0).toLocaleString()} • {etf.shares} shares
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${etf.lastPrice.toFixed(2)}/share
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">
                      Scoring: {preferences.scoreSource} • Weighting: {preferences.weighting} • Max: {(preferences.maxWeight * 100)}%
                    </div>
                    <Button className="w-full" onClick={exportToCSV}>
                      Export AI Portfolio to CSV
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No ETFs found with sufficient data ({preferences.minTradingDays}+ trading days preferred).
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try reducing minimum trading days to include more ETFs with available data.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setPreferences(p => ({ ...p, minTradingDays: Math.max(30, p.minTradingDays - 30) }))}
                  className="mt-4"
                >
                  Reduce to {Math.max(30, preferences.minTradingDays - 30)} Days
                </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Portfolio;