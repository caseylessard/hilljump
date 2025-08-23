import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from 'lucide-react';
import { ETFTable } from '@/components/dashboard/ETFTable';
import { ScoringControls } from '@/components/dashboard/ScoringControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScoredETF, scoreETFs } from '@/lib/scoring';
import { fetchLivePricesWithDataSources, LivePrice } from '@/lib/live';
import { Distribution, fetchLatestDistributions } from '@/lib/dividends';
import { getETFs } from '@/lib/db';
import { UserBadge } from '@/components/UserBadge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';

type FilterType = 'all' | 'canada' | 'usa' | 'high-yield';

// Load cached state from localStorage
const loadCachedState = () => {
  try {
    const cached = localStorage.getItem('ranking-state');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        weights: parsed.weights || { return: 0.6, yield: 0.2, risk: 0.2 },
        filter: parsed.filter || "All ETFs"
      };
    }
  } catch (e) {
    console.warn('Failed to load cached ranking state:', e);
  }
  return {
    weights: { return: 0.6, yield: 0.2, risk: 0.2 },
    filter: "All ETFs"
  };
};

const cachedState = loadCachedState();

const Ranking = () => {
  const [weights, setWeights] = useState(cachedState.weights);
  const [showDialog, setShowDialog] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});
  const [distributions, setDistributions] = useState<Record<string, Distribution>>({});
  const [filter, setFilter] = useState<string>(cachedState.filter);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: etfs = [], isLoading, error } = useQuery({ 
    queryKey: ["etfs"], 
    queryFn: getETFs, 
    staleTime: 60_000 
  });

  const ranked: ScoredETF[] = useMemo(() => scoreETFs(etfs, weights, livePrices), [etfs, weights, livePrices]);
  
  const filtered: ScoredETF[] = useMemo(() => {
    // Filter out ETFs with invalid data (null prices, zero yields, extremely low AUM)
    const validETFs = ranked.filter(etf => {
      // Exclude ETFs with clearly invalid data
      if (etf.current_price === 50.0) return false; // Remove $50 dummy prices
      if (etf.aum && etf.aum < 1000000) return false; // AUM less than $1M is likely invalid
      if (etf.avgVolume && etf.avgVolume < 100) return false; // Very low volume indicates inactive ETF
      return true;
    });
    
    if (filter === "All ETFs") return validETFs;
    if (filter === "YieldMax") return validETFs.filter(e => (e.category || "").toLowerCase().includes("yieldmax"));
    if (filter === "Covered Call") return validETFs.filter(e => e.category === "Covered Call");
    if (filter === "Income") return validETFs.filter(e => e.category === "Income");
    if (filter === "Dividend") return validETFs.filter(e => e.category === "Dividend");
    if (filter === "US Funds") return validETFs.filter(e => (e.category || "").includes("(US)") || /NYSE|NASDAQ/i.test(e.exchange));
    if (filter === "Canadian Funds") return validETFs.filter(e => (e.category || "").includes("(CA)") || /TSX|NEO|TSXV/i.test(e.exchange));
    return validETFs;
  }, [ranked, filter]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) { 
        setIsSubscribed(false); 
        setIsAdmin(false); 
        return; 
      }
      
      const [{ data: sub }, { data: roles }] = await Promise.all([
        supabase.from('subscribers').select('subscribed').eq('user_id', uid).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', uid)
      ]);
      
      setIsSubscribed(Boolean((sub as any)?.subscribed));
      setIsAdmin(Array.isArray(roles) && roles.some((r: any) => String(r.role).toLowerCase() === 'admin'));
    })();
  }, []);

  useEffect(() => {
    document.title = "HillJump — Top Dividend ETF Rankings";
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'HillJump quick reference: All high-yield dividend ETFs ranked by risk-aware total return.');
  }, []);

  useEffect(() => {
    if (!etfs.length) return;
    let cancelled = false;

    const run = async () => {
      try {
        const tickers = etfs.map(e => e.ticker);
        const prices = await fetchLivePricesWithDataSources(tickers);
        if (cancelled) return;
        setLivePrices(prices);
        toast({ 
          title: "Live data", 
          description: `Updated ${Object.keys(prices).length} tickers.` 
        });
      } catch (e) {
        console.error(e);
      }
    };

    run();
    const id = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [etfs, toast]);

  useEffect(() => {
    if (!etfs.length) return;
    let cancelled = false;
    
    const run = async () => {
      try {
        const map = await fetchLatestDistributions(etfs.map(e => e.ticker));
        if (cancelled) return;
        setDistributions(map);
      } catch (e) {
        console.error(e);
      }
    };
    
    run();
    return () => { cancelled = true; };
  }, [etfs]);

  // Save state to localStorage whenever weights or filter changes
  useEffect(() => {
    try {
      localStorage.setItem('ranking-state', JSON.stringify({ weights, filter }));
    } catch (e) {
      console.warn('Failed to save ranking state to localStorage:', e);
    }
  }, [weights, filter]);

  return (
    <div className="min-h-screen">
      <Navigation />
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 ambient-spotlight pointer-events-none" aria-hidden="true" />
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
                  <SelectItem value="All ETFs">All ETFs</SelectItem>
                  <SelectItem value="YieldMax">YieldMax</SelectItem>
                  <SelectItem value="Covered Call">Covered Call</SelectItem>
                  <SelectItem value="Income">Income</SelectItem>
                  <SelectItem value="Dividend">Dividend</SelectItem>
                  <SelectItem value="US Funds">US Funds</SelectItem>
                  <SelectItem value="Canadian Funds">Canadian Funds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(isSubscribed || isAdmin) && (
              <Button onClick={() => setShowDialog(true)} className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Adjust Scoring
              </Button>
            )}
          </div>

          <ETFTable 
            items={filtered} 
            live={livePrices}
            distributions={distributions}
          />
        </section>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Scoring</DialogTitle>
            </DialogHeader>
            {(isSubscribed || isAdmin) ? (
              <ScoringControls onChange={setWeights} />
            ) : (
              <div className="text-sm text-muted-foreground">Subscribe to adjust scoring.</div>
            )}
          </DialogContent>
        </Dialog>

        <p className="text-muted-foreground text-xs">Not investment advice.</p>
      </main>
    </div>
  );
};

export default Ranking;