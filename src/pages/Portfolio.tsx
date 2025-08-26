import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCachedETFs, useCachedPrices, useCachedStoredScores } from "@/hooks/useCachedETFData";
import { scoreETFs, ScoredETF } from "@/lib/scoring";
import Navigation from "@/components/Navigation";
import { TrendingUp, DollarSign, Globe, Building2, Zap, PieChart } from "lucide-react";

const Portfolio = () => {
  // Portfolio preferences with sliders
  const [preferences, setPreferences] = useState({
    performance: 70,        // Weight on total return and DRIP performance
    diversification: 60,    // Preference for diversified holdings
    canadianBias: 70,      // Preference for Canadian ETFs
    usBias: 30,            // Preference for US ETFs  
    industryDiversity: 50, // Spread across different industries
    riskTolerance: 50,     // Higher = more volatile/growth, Lower = more stable
    yieldFocus: 40,        // Focus on dividend yield
    maxPositions: 10       // Maximum number of ETF positions
  });

  const [portfolioSize, setPortfolioSize] = useState(100000); // $100k default
  const [selectedETFs, setSelectedETFs] = useState<ScoredETF[]>([]);

  // Fetch data
  const { data: etfs = [], isLoading: etfsLoading } = useCachedETFs();
  const { data: prices = {} } = useCachedPrices(etfs.map(e => e.ticker));
  const { data: storedScores = {} } = useCachedStoredScores(etfs.map(e => e.ticker), {
    return: 0.6, yield: 0.2, risk: 0.2
  });

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

  // AI Portfolio Builder Logic
  const buildPortfolio = useMemo(() => {
    if (etfs.length === 0) return [];

    // Score and rank ETFs based on preferences
    const scoredETFs = scoreETFs(etfs, {
      return: preferences.performance / 100 * 0.6,
      yield: preferences.yieldFocus / 100 * 0.3,
      risk: (100 - preferences.riskTolerance) / 100 * 0.1
    }, prices);

    // Filter and weight by geographic preferences
    const withGeoWeights = scoredETFs.map(etf => {
      let geoScore = 0;
      const isCanadian = /TSX|NEO|TSXV|\.TO/i.test(etf.exchange) || 
                        (etf.country || "").toUpperCase() === 'CA' ||
                        etf.ticker.endsWith('.TO');
      
      if (isCanadian) {
        geoScore = preferences.canadianBias / 100;
      } else {
        geoScore = preferences.usBias / 100;
      }

      return {
        ...etf,
        adjustedScore: (etf.compositeScore || 0) * (0.7 + geoScore * 0.3)
      };
    });

    // Sort by adjusted score and apply diversification
    let selected = withGeoWeights
      .sort((a, b) => (b.adjustedScore || 0) - (a.adjustedScore || 0))
      .slice(0, preferences.maxPositions * 2); // Get more candidates for diversification

    // Apply industry diversification (simplified)
    const diversified: typeof selected = [];
    const industryCount: Record<string, number> = {};
    const maxPerIndustry = Math.ceil(preferences.maxPositions / 3); // Max ~3-4 per industry

    for (const etf of selected) {
      const industry = etf.category || etf.industry || 'Other';
      const currentCount = industryCount[industry] || 0;
      
      if (currentCount < maxPerIndustry || diversified.length < preferences.maxPositions) {
        diversified.push(etf);
        industryCount[industry] = currentCount + 1;
        
        if (diversified.length >= preferences.maxPositions) break;
      }
    }

    return diversified;
  }, [etfs, preferences, prices]);

  // Calculate portfolio allocations
  const portfolioAllocations = useMemo(() => {
    if (buildPortfolio.length === 0) return [];

    // Simple equal weight for now, could be optimized based on scores
    const baseWeight = 100 / buildPortfolio.length;
    
    return buildPortfolio.map((etf, index) => {
      // Slight overweight for higher scoring ETFs
      const scoreMultiplier = 0.8 + (etf.adjustedScore || 0) * 0.4;
      const weight = Math.min(baseWeight * scoreMultiplier, 25); // Max 25% per position
      
      return {
        ...etf,
        allocationPercent: weight,
        allocationAmount: (portfolioSize * weight) / 100,
        shares: Math.floor((portfolioSize * weight) / 100 / (prices[etf.ticker]?.price || etf.current_price || 1))
      };
    });
  }, [buildPortfolio, portfolioSize, prices]);

  const totalAllocation = portfolioAllocations.reduce((sum, item) => sum + item.allocationPercent, 0);

  // Export portfolio to CSV
  const exportToCSV = () => {
    if (portfolioAllocations.length === 0) return;

    const csvData = [
      ['Ticker', 'Name', 'Exchange', 'Category', 'Allocation %', 'Allocation Amount', 'Shares', 'Price per Share', 'Country'],
      ...portfolioAllocations.map(etf => [
        etf.ticker,
        etf.name,
        etf.exchange,
        etf.category || '',
        etf.allocationPercent.toFixed(1),
        etf.allocationAmount.toFixed(2),
        etf.shares,
        (prices[etf.ticker]?.price || etf.current_price || 0).toFixed(2),
        etf.country === 'CA' || etf.ticker.endsWith('.TO') ? 'Canada' : 'USA'
      ])
    ];

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `hilljump-portfolio-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <header className="container py-8">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">AI Portfolio Builder</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Build an optimized ETF portfolio using AI-driven recommendations based on performance, diversification, and your preferences.
        </p>
      </header>

      <main className="container grid lg:grid-cols-[1fr,2fr] gap-8 pb-16">
        {/* Controls Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Portfolio Preferences
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

              {/* Performance Focus */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Performance Focus
                  </label>
                  <Badge variant="secondary">{preferences.performance}%</Badge>
                </div>
                <Slider
                  value={[preferences.performance]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, performance: value }))}
                  max={100}
                  step={5}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Higher values prioritize total return and DRIP performance</p>
              </div>

              {/* Geographic Allocation */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Canadian Bias
                  </label>
                  <Badge variant="secondary">{preferences.canadianBias}%</Badge>
                </div>
                <Slider
                  value={[preferences.canadianBias]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, canadianBias: value, usBias: 100 - value }))}
                  max={100}
                  step={5}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Balance between Canadian ({preferences.canadianBias}%) and US ({preferences.usBias}%) ETFs</p>
              </div>

              {/* Diversification */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Industry Diversity
                  </label>
                  <Badge variant="secondary">{preferences.industryDiversity}%</Badge>
                </div>
                <Slider
                  value={[preferences.industryDiversity]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, industryDiversity: value }))}
                  max={100}
                  step={5}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Higher values spread holdings across more industries</p>
              </div>

              {/* Risk Tolerance */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Risk Tolerance</label>
                  <Badge variant="secondary">{preferences.riskTolerance}%</Badge>
                </div>
                <Slider
                  value={[preferences.riskTolerance]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, riskTolerance: value }))}
                  max={100}
                  step={5}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Higher = growth-focused, Lower = stability-focused</p>
              </div>

              {/* Yield Focus */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Dividend Yield Focus</label>
                  <Badge variant="secondary">{preferences.yieldFocus}%</Badge>
                </div>
                <Slider
                  value={[preferences.yieldFocus]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, yieldFocus: value }))}
                  max={100}
                  step={5}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Emphasis on high dividend-paying ETFs</p>
              </div>

              {/* Max Positions */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Max Positions</label>
                  <Badge variant="secondary">{preferences.maxPositions}</Badge>
                </div>
                <Slider
                  value={[preferences.maxPositions]}
                  onValueChange={([value]) => setPreferences(p => ({ ...p, maxPositions: value }))}
                  min={5}
                  max={20}
                  step={1}
                  className="mb-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Results */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recommended Portfolio</CardTitle>
              <p className="text-sm text-muted-foreground">
                {portfolioAllocations.length} positions • ${portfolioSize.toLocaleString()} • {totalAllocation.toFixed(1)}% allocated
              </p>
            </CardHeader>
            <CardContent>
              {etfsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Building your portfolio...</p>
                </div>
              ) : portfolioAllocations.length > 0 ? (
                <div className="space-y-4">
                  {portfolioAllocations.map((etf, index) => (
                    <div key={etf.ticker} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{etf.ticker}</Badge>
                          <span className="font-medium">{etf.name}</span>
                          {(etf.country === 'CA' || etf.ticker.endsWith('.TO')) && (
                            <Badge variant="secondary" className="text-xs">🇨🇦</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {etf.category} • {etf.exchange}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{etf.allocationPercent.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">
                          ${etf.allocationAmount.toLocaleString()} • {etf.shares} shares
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${(prices[etf.ticker]?.price || etf.current_price || 0).toFixed(2)}/share
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t">
                    <Button className="w-full" onClick={exportToCSV}>
                      Export Portfolio to CSV
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No ETFs match your criteria. Try adjusting your preferences.</p>
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