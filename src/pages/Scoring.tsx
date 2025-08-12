import hero from "@/assets/hero-investing.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { SAMPLE_ETFS } from "@/data/etfs";
import { ScoredETF, scoreETFs } from "@/lib/scoring";
import { ScoringControls } from "@/components/dashboard/ScoringControls";
import { ComparisonChart, RangeKey } from "@/components/dashboard/ComparisonChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserBadge } from "@/components/UserBadge";

const UNDERLYING_MAP: Record<string, string> = {
  TSLY: "TSLA",
  NVDY: "NVDA",
  APLY: "AAPL",
  AMDY: "AMD",
};

const Scoring = () => {
  const [weights, setWeights] = useState({ return: 0.6, yield: 0.2, risk: 0.2 });
  const [range, setRange] = useState<RangeKey>("1Y");
  const ranked: ScoredETF[] = useMemo(() => scoreETFs(SAMPLE_ETFS, weights), [weights]);

  const best = ranked[0];
  const underlying = best ? UNDERLYING_MAP[best.ticker] : undefined;

  useEffect(() => {
    document.title = "HillJump — Scoring & Comparison";
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
      'Tune weights and compare the top ETF against its underlying across 1M, 3M, 6M, 1Y ranges.'
    );
  }, []);

  return (
    <div>
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 ambient-spotlight pointer-events-none" aria-hidden="true" />
        <div className="container flex items-center justify-between py-4">
          <a href="/" className="font-bold text-lg tracking-tight" aria-label="HillJump home">
            HillJump
          </a>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <Button variant="ghost" asChild>
              <a href="/">Ranking</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="/scoring">Scoring</a>
            </Button>
            <UserBadge />
          </nav>
        </div>
        <div className="container py-8 grid md:grid-cols-[1.2fr,0.8fr] gap-6 items-center">
          <div className="space-y-3">
            <Badge variant="secondary">Analysis</Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Scoring & Comparison</h1>
            <p className="text-muted-foreground">Compare the best performer against its underlying with DRIP vs price growth.</p>
            <div className="flex gap-3">
              <Button variant="hero" asChild>
                <a href="#chart">View Chart</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/">Back to Ranking</a>
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            <img src={hero} alt="HillJump scoring and comparison hero graphic" loading="lazy" className="w-full h-56 object-cover" />
          </Card>
        </div>
      </header>

      <main className="container grid gap-8 pb-16">
        <section id="chart" aria-labelledby="chart-title" className="grid md:grid-cols-3 gap-6">
          <h2 id="chart-title" className="sr-only">Comparison Chart</h2>
          <div className="md:col-span-2 grid gap-4">
            <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <TabsList>
                <TabsTrigger value="1M">1M</TabsTrigger>
                <TabsTrigger value="3M">3M</TabsTrigger>
                <TabsTrigger value="6M">6M</TabsTrigger>
                <TabsTrigger value="1Y">1Y</TabsTrigger>
              </TabsList>
              <TabsContent value={range}>
                {best && (
                  <ComparisonChart etf={best} underlyingTicker={underlying} range={range} />
                )}
              </TabsContent>
            </Tabs>
          </div>
          <div className="md:col-span-1">
            <ScoringControls onChange={setWeights} />
          </div>
          {!underlying && best && (
            <p className="text-xs text-muted-foreground md:col-span-3">No underlying mapping for {best.ticker}. We’ll add more soon.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default Scoring;
