import hero from "@/assets/hero-investing.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchLatestDistributions, Distribution, predictNextDistribution } from "@/lib/dividends";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SAMPLE_ETFS } from "@/data/etfs";
import { ScoredETF, scoreETFs } from "@/lib/scoring";
import { getETFs } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScoringControls } from "@/components/dashboard/ScoringControls";
import { ETFTable } from "@/components/dashboard/ETFTable";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { UserBadge } from "@/components/UserBadge";
import { useCachedETFs, useCachedYields } from "@/hooks/useCachedETFData";
import { useCachedFirstThenLive } from "@/hooks/useCachedFirstThenLive";
import Navigation from "@/components/Navigation";
import { CacheMonitor } from "@/components/CacheMonitor";
import { TiingoYieldsTest } from "@/components/TiingoYieldsTest";
import HistoricalPriceTest from "@/components/HistoricalPriceTest";

const Index = () => {  
  const { toast } = useToast();
  const [weights, setWeights] = useState({ return: 0.6, yield: 0.2, risk: 0.2 });
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  
  // Use cached ETFs data
  const { data: etfs = [], isLoading, error } = useCachedETFs();
  
  // Memoize tickers to prevent unnecessary refetches
  const tickers = useMemo(() => etfs.map(etf => etf.ticker), [etfs]);
  
  // Use cached-first then live data loading pattern
  const { prices: livePrices, distributions, dripData, isLoadingLive } = useCachedFirstThenLive(tickers);

  // Show loading status for live data updates
  useEffect(() => {
    if (isLoadingLive) {
      toast({
        title: "Updating data",
        description: "Fetching latest prices in background...",
      });
    }
  }, [isLoadingLive, toast]);

  // Debug ETFs loading
  useEffect(() => {
    console.log('🔍 ETFs debug:', {
      etfsLength: etfs.length,
      isLoading,
      firstFewETFs: etfs.slice(0, 3).map(e => ({ ticker: e.ticker, name: e.name }))
    });
  }, [etfs, isLoading]);

  // Fetch Yahoo Finance yields for testing
  const { data: yfinanceYields = {}, isLoading: yieldsLoading, error: yieldsError } = useCachedYields(etfs.map(e => e.ticker));

  // Debug yields data
  useEffect(() => {
    if (etfs.length > 0) {
      console.log('🔍 Yields debug:', {
        etfCount: etfs.length,
        firstFewTickers: etfs.slice(0, 3).map(e => e.ticker),
        yieldsLoading,
        yieldsError,
        yieldsFound: Object.keys(yfinanceYields).length,
        sampleYields: Object.entries(yfinanceYields).slice(0, 3)
      });
    }
  }, [etfs.length, yieldsLoading, yieldsError, yfinanceYields]);

  // Track mouse movement for background effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Use real ETF data if available, fallback to sample data
  const dataToUse = etfs.length > 0 ? etfs.map(etf => ({
    ...etf,
    yieldTTM: yfinanceYields[etf.ticker] || etf.yieldTTM || 0
  })) : SAMPLE_ETFS;
  const ranked: ScoredETF[] = useMemo(() => scoreETFs(dataToUse, weights, livePrices), [dataToUse, weights, livePrices, yfinanceYields]);

  // Filter to show only Canadian high-yield funds for the hero section
  const topETFs = ranked
    .filter(etf => {
      const isCanadian = (etf.country || "").toUpperCase() === 'CA' || 
                         /TSX|NEO|TSXV/i.test(etf.exchange) || 
                         etf.ticker.endsWith('.TO');
      const hasGoodYield = (etf.yieldTTM || 0) >= 4; // 4%+ yield
      return isCanadian && hasGoodYield;
    })
    .slice(0, 8);

  // SEO structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "HillJump",
    "description": "Comprehensive ETF analysis and dividend investment tools for Canadian investors",
    "url": "https://hilljump.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://hilljump.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at ${mouse.x}px ${mouse.y}px, hsl(var(--primary)) 0%, transparent 50%)`,
            transition: 'background 0.3s ease'
          }}
        />
        
        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="w-fit">
                  🇨🇦 Built for Canadian Investors
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                  Smart ETF Analysis
                  <span className="text-primary block">& Dividends</span>
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
                  All high-yield dividend ETFs ranked by risk-aware total return. Live data where available.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-lg px-8">
                  Explore ETFs
                </Button>
                <Button variant="outline" size="lg" className="text-lg px-8">
                  Learn More
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <img 
                src={hero} 
                alt="Investment analysis dashboard showing ETF performance metrics" 
                className="rounded-2xl shadow-2xl w-full h-auto"
                loading="eager"
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/20 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Testing Components */}
      <div className="container py-8 space-y-6">
        <TiingoYieldsTest />
        <HistoricalPriceTest />
      </div>

      {/* Performance Chart Section */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Performance Overview</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Track the performance of top Canadian dividend ETFs with real-time data and analysis.
            </p>
          </div>
          
          <Card className="p-6">
            <PerformanceChart items={topETFs} />
          </Card>
        </div>
      </section>

      {/* Interactive Controls */}
      <section className="py-16 bg-muted/20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Customize Your Analysis</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Adjust scoring weights to match your investment strategy and risk tolerance.
            </p>
          </div>
          
          <Card className="max-w-4xl mx-auto p-6">
            <ScoringControls onChange={setWeights} />
          </Card>
        </div>
      </section>

      {/* Top ETFs Table */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Top Canadian Dividend ETFs</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Discover the highest-ranked Canadian dividend ETFs based on our comprehensive scoring system.
            </p>
          </div>
          
          {isLoading ? (
            <Card className="p-12 text-center">
              <p className="text-lg text-muted-foreground">Loading ETF data...</p>
            </Card>
          ) : topETFs.length > 0 ? (
            <ETFTable 
              items={topETFs} 
              live={livePrices} 
              distributions={distributions}
            />
          ) : (
            <Card className="p-12 text-center">
              <p className="text-lg text-muted-foreground">
                No Canadian high-yield ETFs found matching criteria.
              </p>
            </Card>
          )}
        </div>
      </section>

      <CacheMonitor />

      {/* SEO structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
};

export default Index;