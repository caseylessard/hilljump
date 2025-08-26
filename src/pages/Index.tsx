import hero from "@/assets/hero-investing.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchLatestDistributions, Distribution, predictNextDistribution } from "@/lib/dividends";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SAMPLE_ETFS } from "@/data/etfs";
import { ScoredETF, scoreETFs } from "@/lib/scoring";
import { fetchLivePricesWithDataSources, LivePrice } from "@/lib/live";
import { getETFs } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScoringControls } from "@/components/dashboard/ScoringControls";
import { ETFTable } from "@/components/dashboard/ETFTable";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { UserBadge } from "@/components/UserBadge";
import { useCachedETFs, useCachedPrices, useCachedYields, useCachedStoredScores, useCachedDistributions } from "@/hooks/useCachedETFData";
import Navigation from "@/components/Navigation";
import { CacheMonitor } from "@/components/CacheMonitor";
import { LoadingProgress } from "@/components/LoadingProgress";



const Index = () => {
  const { toast } = useToast();
  const [weights, setWeights] = useState({ return: 0.6, yield: 0.2, risk: 0.2 });
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  
  // Load order: 1. Stored scores, 2. Stored prices, 3. Distributions, 4. Live prices (background)
  
  // 1. Fetch real ETF data from database
  const { data: etfs = [], isLoading } = useCachedETFs();

  // 2. Fetch stored scores first (fastest)
  const { data: storedScores = {}, isLoading: scoresLoading } = useCachedStoredScores(etfs.map(e => e.ticker), weights);

  // 3. Fetch stored prices (loads immediately, then background refresh)
  const { data: livePrices = {}, isLoading: pricesLoading } = useCachedPrices(etfs.map(e => e.ticker));

  // 4. Fetch distributions (after prices are available)
  const { data: distributions = {}, isLoading: distributionsLoading } = useCachedDistributions(etfs.map(e => e.ticker));

  // 5. Fetch yields (runs in parallel with distributions)
  const { data: yfinanceYields = {}, isLoading: yieldsLoading, error: yieldsError } = useCachedYields(etfs.map(e => e.ticker));

  // Debug ETFs loading
  useEffect(() => {
    console.log('🔍 ETFs debug:', {
      etfsLength: etfs.length,
      isLoading,
      firstFewETFs: etfs.slice(0, 3).map(e => ({ ticker: e.ticker, name: e.name }))
    });
  }, [etfs, isLoading]);

  // Debug loading states
  useEffect(() => {
    console.log('🔍 Loading states:', {
      etfsLoading: isLoading,
      scoresLoading,
      pricesLoading,
      distributionsLoading,
      yieldsLoading,
      yieldsError
    });
  }, [isLoading, scoresLoading, pricesLoading, distributionsLoading, yieldsLoading, yieldsError]);

  useEffect(() => {
    // Clear all caches on page load
    console.log('🧹 Clearing all caches on Index page load');
    
    // Clear React Query cache if available
    try {
      // Force clear browser caches
      if (typeof window !== 'undefined') {
        // Clear localStorage cache entries
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('cache-') || key.startsWith('yields-') || key.startsWith('etf-') || key.includes('react-query')) {
            localStorage.removeItem(key);
          }
        });
        console.log('✅ localStorage cache cleared');
      }
    } catch (e) {
      console.log('⚠️ Could not clear cache:', e);
    }
    
    // SEO: Title, description, canonical
    document.title = "HillJump — Income ETFs by Total Return";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute(
      'content',
      'HillJump ranks top 10 high-yield income ETFs by total return with risk-aware scoring for volume, volatility, drawdown, and fees.'
    );

    const link =
      (document.querySelector('link[rel="canonical"]') as HTMLLinkElement) ||
      (() => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        document.head.appendChild(l);
        return l as HTMLLinkElement;
      })();
    link.setAttribute('href', window.location.origin + window.location.pathname);
  }, []); // Remove toast dependency to prevent loops

  // Use real ETF data if available, fallback to sample data
  const dataToUse = etfs.length > 0 ? etfs.map(etf => ({
    ...etf,
    yieldTTM: yfinanceYields[etf.ticker] || etf.yieldTTM || 0
  })) : SAMPLE_ETFS;
  
  // Prioritize stored scores, fallback to live calculation
  const ranked: ScoredETF[] = useMemo(() => {
    if (dataToUse.length === 0) return [];
    
    // Check if we have stored scores for most ETFs
    const storedScoreCount = Object.keys(storedScores).length;
    const dataCount = dataToUse.length;
    
    console.log(`🎯 Stored scores: ${storedScoreCount}/${dataCount} ETFs`);
    
    // Always calculate scores using scoreETFs to ensure proper typing
    // But if we have fresh stored scores, we could potentially skip recalculation in the future
    console.log('🧮 Calculating scores...');
    const liveScored = scoreETFs(dataToUse, weights, livePrices);
    
    // Save the calculated scores to database (async, don't wait)
    if (storedScoreCount < dataCount * 0.9) { // Only save if we don't have most scores stored
      import('@/lib/cache').then(({ saveCachedScores }) => {
        saveCachedScores(liveScored, weights);
      });
    }
    
    return liveScored;
  }, [dataToUse, weights, livePrices, storedScores, yfinanceYields]);
  
  // Filter for high-yield ETFs (top performers)
  const topETFs: ScoredETF[] = useMemo(() => {
    // Show Canadian funds that typically have higher yields
    const canadianFunds = ranked.filter(e => 
      /TSX|NEO|TSXV/i.test(e.exchange) || 
      (e.country || "").toUpperCase() === 'CA' ||
      e.ticker.endsWith('.TO')
    );
    
    // Show top ETFs by composite score, prioritizing Canadian high-yield funds
    const topFunds = ranked.slice(0, 20);
    
    // Combine and dedupe, prioritizing Canadian funds
    const combined = [...canadianFunds, ...topFunds];
    const unique = combined.filter((etf, index, arr) => 
      arr.findIndex(e => e.ticker === etf.ticker) === index
    );
    
    return unique.slice(0, 15); // Show top 15 diverse high-yield ETFs
  }, [ranked]);

  const jsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Top 10 High Yield Income ETFs by Total Return",
    itemListElement: ranked.map((etf, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "InvestmentFund",
        name: etf.name,
        tickerSymbol: etf.ticker,
        category: etf.category || "ETF",
      }
    }))
  }), [ranked]);

  return (
    <div onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })} style={{ ['--mx' as any]: `${mouse.x}px`, ['--my' as any]: `${mouse.y}px` }}>
      <Navigation />
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 ambient-spotlight pointer-events-none" aria-hidden="true" />

        {/* Hero section */}
        <div className="container py-10 grid md:grid-cols-[1.2fr,0.8fr] gap-6 items-center">
          <div className="space-y-4">
            <Badge variant="secondary">HillJump</Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Top 10 High-Yield Income ETFs by Total Return</h1>
            <p className="text-muted-foreground">Risk-aware ranking that prioritizes total return while devaluing funds for low volume, high volatility, deep drawdowns, and fees.</p>
            <div className="flex gap-3">
              <Button variant="hero" asChild>
                <a href="#ranking">Explore Ranking</a>
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            <img src={hero} alt="HillJump dividend ETF ranking dashboard hero with futuristic cyan-blue gradient" loading="lazy" className="w-full h-56 object-cover" />
          </Card>
        </div>
        
        <div className="container">
          <LoadingProgress 
            etfsLoading={isLoading}
            pricesLoading={pricesLoading}
            distributionsLoading={distributionsLoading}
            scoresLoading={scoresLoading}
            yieldsLoading={yieldsLoading}
          />
        </div>
      </header>

      <main className="container grid gap-8 pb-16">
        <section aria-labelledby="scoring" className="grid md:grid-cols-3 gap-6">
          <h2 id="scoring" className="sr-only">Scoring Controls</h2>
          <div className="md:col-span-2">
            <PerformanceChart items={ranked} />
          </div>
          <div className="md:col-span-1">
            <ScoringControls onChange={setWeights} />
          </div>
        </section>

        <section id="ranking" aria-labelledby="ranking-title" className="grid gap-4">
          <h2 id="ranking-title" className="text-2xl font-semibold">Ranking</h2>
          <ETFTable items={topETFs} live={livePrices} distributions={distributions} />
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CacheMonitor />
    </div>
  );
};

export default Index;
