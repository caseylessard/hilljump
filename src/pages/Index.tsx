import hero from "@/assets/hero-investing.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SAMPLE_ETFS } from "@/data/etfs";
import { ScoredETF, scoreETFs } from "@/lib/scoring";
import { ScoringControls } from "@/components/dashboard/ScoringControls";
import { ETFTable } from "@/components/dashboard/ETFTable";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";

const Index = () => {
  const { toast } = useToast();
  const [weights, setWeights] = useState({ return: 0.6, yield: 0.2, risk: 0.2 });
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    toast({ title: "Sample data", description: "Using illustrative ETF data. Live data integration coming soon." });
  }, [toast]);

  const ranked: ScoredETF[] = useMemo(() => scoreETFs(SAMPLE_ETFS, weights), [weights]);

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
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 ambient-spotlight pointer-events-none" aria-hidden="true" />
        <div className="container py-10 grid md:grid-cols-[1.2fr,0.8fr] gap-6 items-center">
          <div className="space-y-4">
            <Badge variant="secondary">Investing Dashboard</Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Top 10 High-Yield Dividend ETFs by Total Return</h1>
            <p className="text-muted-foreground">Risk-aware ranking that prioritizes total return while devaluing funds for low volume, high volatility, deep drawdowns, and fees.</p>
            <div className="flex gap-3">
              <Button variant="hero">Recalculate</Button>
              <Button variant="outline" asChild>
                <a href="#ranking">View Ranking</a>
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            <img src={hero} alt="Futuristic finance dashboard background with cyan-blue gradient" loading="lazy" className="w-full h-56 object-cover" />
          </Card>
        </div>
      </header>

      <main className="container grid gap-8 pb-16">
        <section aria-labelledby="scoring" className="grid md:grid-cols-3 gap-6">
          <h2 id="scoring" className="sr-only">Scoring Controls</h2>
          <div className="md:col-span-1">
            <ScoringControls onChange={setWeights} />
          </div>
          <div className="md:col-span-2">
            <PerformanceChart items={ranked} />
          </div>
        </section>

        <section id="ranking" aria-labelledby="ranking-title" className="grid gap-4">
          <h2 id="ranking-title" className="text-2xl font-semibold">Ranking</h2>
          <ETFTable items={ranked} />
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
};

export default Index;
