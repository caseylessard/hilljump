
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { useEffect, useMemo, useState } from "react";
import { SAMPLE_ETFS } from "@/data/etfs";
import { ScoredETF, scoreETFs } from "@/lib/scoring";
import { ETFTable } from "@/components/dashboard/ETFTable";

const Ranking = () => {
  // Default weights for quick reference
  const [weights] = useState({ return: 0.6, yield: 0.2, risk: 0.2 });
  const ranked: ScoredETF[] = useMemo(() => scoreETFs(SAMPLE_ETFS, weights), [weights]);

  useEffect(() => {
    document.title = "HillJump — Top Dividend ETF Rankings";
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
      'HillJump quick reference: Top 100 high-yield dividend ETFs ranked by risk-aware total return.'
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
          </nav>
        </div>
        <div className="container py-8 grid md:grid-cols-[1.2fr,0.8fr] gap-6 items-center">
          <div className="space-y-3">
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Dividend ETF Rankings</h1>
            
          </div>
        </div>
      </header>

      <main className="container grid gap-8 pb-16">
        <section id="ranking" aria-labelledby="ranking-title" className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 id="ranking-title" className="text-2xl font-semibold">Top 100</h2>
            <Button variant="outline" asChild>
              <a href="/scoring">Adjust Scoring</a>
            </Button>
          </div>
          <ETFTable items={ranked} />
        </section>
          <p className="text-muted-foreground text-xs">Not investment advice.</p>
        </main>
    </div>
  );
};

export default Ranking;
