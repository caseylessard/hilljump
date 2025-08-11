import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { ScoredETF, scoreETFs } from "@/lib/scoring";
import { ETFTable } from "@/components/dashboard/ETFTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoringControls } from "@/components/dashboard/ScoringControls";
import { fetchLivePrices, type LivePrice } from "@/lib/live";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getETFs } from "@/lib/db";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const Ranking = () => {
  // Default weights for quick reference
  const [weights, setWeights] = useState({ return: 0.6, yield: 0.2, risk: 0.2 });
  const [scoreOpen, setScoreOpen] = useState(false);
  const [live, setLive] = useState<Record<string, LivePrice>>({});
  const { toast } = useToast();
  const { data: etfs = [], isLoading, error } = useQuery({ queryKey: ["etfs"], queryFn: getETFs, staleTime: 60_000 });
  const ranked: ScoredETF[] = useMemo(() => scoreETFs(etfs, weights, live), [etfs, weights, live]);
  const [filter, setFilter] = useState<string>("YieldMax");
  const filtered: ScoredETF[] = useMemo(() => {
    if (filter === "Top 100") return ranked;
    if (filter === "YieldMax") return ranked.filter(e => (e.category || "").toLowerCase().includes("yieldmax"));
    if (filter === "Covered Call") return ranked.filter(e => e.category === "Covered Call");
    if (filter === "Income") return ranked.filter(e => e.category === "Income");
    if (filter === "Dividend") return ranked.filter(e => e.category === "Dividend");
    if (filter === "US Funds") return ranked.filter(e => (e.category || "").includes("(US)") || /NYSE|NASDAQ/i.test(e.exchange));
    if (filter === "Canadian Funds") return ranked.filter(e => (e.category || "").includes("(CA)") || /TSX|NEO|TSXV/i.test(e.exchange));
    return ranked;
  }, [ranked, filter]);

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
    const link =
      (document.querySelector('link[rel="canonical"]') as HTMLLinkElement) ||
      (() => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        document.head.appendChild(l);
        return l as HTMLLinkElement;
      })();
    link.setAttribute('href', window.location.origin + window.location.pathname);
  }, []);

  useEffect(() => {
    // Fetch live prices for all filtered tickers and refresh every 60s
    const base = etfs;
    let subset = base;
    if (filter === "YieldMax") subset = base.filter(e => (e.category || "").toLowerCase().includes("yieldmax"));
    else if (filter === "Covered Call") subset = base.filter(e => e.category === "Covered Call");
    else if (filter === "Income") subset = base.filter(e => e.category === "Income");
    else if (filter === "Dividend") subset = base.filter(e => e.category === "Dividend");
    else if (filter === "US Funds") subset = base.filter(e => (e.category || "").includes("(US)") || /NYSE|NASDAQ/i.test(e.exchange));
    else if (filter === "Canadian Funds") subset = base.filter(e => (e.category || "").includes("(CA)") || /TSX|NEO|TSXV/i.test(e.exchange));
    const tickers = (filter === "Top 100" ? base : subset).map(e => e.ticker);
    if (!tickers.length) return;

    let cancelled = false;

    const run = async () => {
      try {
        const prices = await fetchLivePrices(tickers);
        if (cancelled) return;
        setLive(prices);
        toast({ title: "Live data", description: `Updated ${Object.keys(prices).length} tickers.` });
      } catch (e) {
        console.error(e);
      }
    };

    run();
    const id = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [etfs, filter, toast]);

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
              <a href="/">Dividends</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="/options">Options</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="/crypto">Crypto</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="/profile">Profile</a>
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
            <div className="flex items-center gap-3">
              <h2 id="ranking-title" className="text-2xl font-semibold">Ranking</h2>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background shadow-lg">
                  <SelectItem value="Top 100">Top 100</SelectItem>
                  <SelectItem value="YieldMax">YieldMax</SelectItem>
                  <SelectItem value="Covered Call">Covered Call</SelectItem>
                  <SelectItem value="Income">Income</SelectItem>
                  <SelectItem value="Dividend">Dividend</SelectItem>
                  <SelectItem value="US Funds">US Funds</SelectItem>
                  <SelectItem value="Canadian Funds">Canadian Funds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {Object.keys(live).length > 0 && <span className="text-xs text-muted-foreground">Live: {Object.keys(live).length}</span>}
              <Button variant="outline" onClick={() => setScoreOpen(true)}>Adjust Scoring</Button>
            </div>
            <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust Scoring</DialogTitle>
                </DialogHeader>
                <ScoringControls onChange={setWeights} />
              </DialogContent>
            </Dialog>
          </div>
          <ETFTable items={filtered} live={live} />
        </section>
          <p className="text-muted-foreground text-xs">Not investment advice.</p>
        </main>
    </div>
  );
};

export default Ranking;
