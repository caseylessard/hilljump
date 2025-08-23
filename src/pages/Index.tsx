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
import { updateCanadianPrices } from "@/utils/canadianPriceUpdater";
import Navigation from "@/components/Navigation";
import { CacheMonitor } from "@/components/CacheMonitor";
import { warmSpecificCache } from "@/lib/cacheUtils";

const Index = () => {
  const { toast } = useToast();
  const [weights, setWeights] = useState({ return: 0.6, yield: 0.2, risk: 0.2 });
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});

  // Reload cache on component mount
  useEffect(() => {
    const reloadCache = async () => {
      console.log('🔄 Reloading cache...');
      await warmSpecificCache('all');
      console.log('✅ Cache reloaded successfully');
    };
    reloadCache();
  }, []);
  
  // Fetch real ETF data from database
  const { data: etfs = [], isLoading } = useQuery({ 
    queryKey: ["etfs"], 
    queryFn: async () => {
      const { getCachedData } = await import('@/lib/cache');
      return getCachedData('ranking', getETFs, 'all-etfs');
    },
    staleTime: 60_000 
  });

  // Fetch dividend distributions for ETFs
  const { data: distributions = {} } = useQuery({
    queryKey: ["distributions", etfs.map(e => e.ticker)],
    queryFn: async () => {
      const { getCachedData } = await import('@/lib/cache');
      const cacheKey = etfs.map(e => e.ticker).sort().join(',');
      return getCachedData(
        'lastDist',
        () => fetchLatestDistributions(etfs.map(e => e.ticker)),
        cacheKey
      );
    },
    enabled: etfs.length > 0,
    staleTime: 300_000 // 5 minutes
  });

  // Fetch yields from Yahoo Finance
  const { data: yfinanceYields = {} } = useQuery({
    queryKey: ["yfinance-yields", etfs.map(e => e.ticker)],
    queryFn: async () => {
      const { getCachedData } = await import('@/lib/cache');
      const cacheKey = etfs.map(e => e.ticker).sort().join(',');
      
      return getCachedData(
        'yield',
        async () => {
          try {
            console.log('🔍 Fetching Yahoo Finance yields for', etfs.length, 'tickers...');
            const { data, error } = await supabase.functions.invoke('yfinance-yields', {
              body: { tickers: etfs.map(e => e.ticker) }
            });

            if (error) throw error;
            return data || {};
          } catch (error) {
            console.error('❌ Yahoo Finance yields failed:', error);
            return {};
          }
        },
        cacheKey
      );
    },
    enabled: etfs.length > 0,
    staleTime: 1800_000 // 30 minutes
   });

  // Fetch live prices for real ETFs
  useEffect(() => {
    if (!etfs.length) return;
    let cancelled = false;

    const run = async () => {
      try {
        const tickers = etfs.map(e => e.ticker);
        
        const { getCachedETFPrices } = await import('@/lib/cache');
        const prices = await getCachedETFPrices(tickers);
        
        if (cancelled) return;
        setLivePrices(prices);
        console.log(`Updated ${Object.keys(prices).length} live prices from cache`);
      } catch (e) {
        console.error('Live price fetch error:', e);
        // Don't show toast on every error to avoid spam
      }
    };

    run();
    return () => { cancelled = true; };
  }, [etfs]); // Remove toast from dependencies to prevent loops

  // Update Canadian prices when component loads
  useEffect(() => {
    const updatePrices = async () => {
      try {
        console.log('Starting Canadian price update...');
        const result = await updateCanadianPrices();
        if (result.success) {
          console.log('✅ Canadian prices updated successfully:', result.message);
          // Don't reload - let live data refresh naturally
        } else {
          console.error('❌ Canadian price update failed:', result.message);
        }
      } catch (error) {
        console.error('❌ Canadian price update error:', error);
      }
    };
    
    // Always try to update prices when ETFs are loaded
    if (etfs.length > 0) {
      updatePrices();
    }
  }, [etfs.length]); // Simplified dependency

  useEffect(() => {
    // SEO: Title, description, canonical
    document.title = "HillJump — Dividend ETF Rankings by Total Return";
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
      'HillJump ranks top 10 high-yield dividend ETFs by total return with risk-aware scoring for volume, volatility, drawdown, and fees.'
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
  const ranked: ScoredETF[] = useMemo(() => scoreETFs(dataToUse, weights, livePrices), [dataToUse, weights, livePrices, yfinanceYields]);
  
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
    name: "Top 10 High Yield Dividend ETFs by Total Return",
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
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Top 10 High-Yield Dividend ETFs by Total Return</h1>
            <p className="text-muted-foreground">Risk-aware ranking that prioritizes total return while devaluing funds for low volume, high volatility, deep drawdowns, and fees.</p>
            <div className="flex gap-3">
              <Button variant="hero" asChild>
                <a href="#ranking">Explore Ranking</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="#scoring">Adjust Scoring</a>
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            <img src={hero} alt="HillJump dividend ETF ranking dashboard hero with futuristic cyan-blue gradient" loading="lazy" className="w-full h-56 object-cover" />
          </Card>
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
