import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScoredETF } from "@/lib/scoring";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { predictNextDistribution } from "@/lib/dividends";
import { useCachedDRIP } from "@/hooks/useCachedETFData";
import { useRankingHistory, type RankingChange } from "@/hooks/useRankingHistory";

import { DistributionHistory } from "@/components/dashboard/DistributionHistory";
import { ArrowUpRight, ArrowDownRight, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import type { LivePrice } from "@/lib/live";
import yieldmaxLogo from "@/assets/logos/yieldmax.png";
import globalxLogo from "@/assets/logos/globalx.png";
import jpmorganLogo from "@/assets/logos/jpmorgan.png";
import amplifyLogo from "@/assets/logos/amplify.png";
import roundhillLogo from "@/assets/logos/roundhill.svg";

type Props = {
  items: ScoredETF[];
  live?: Record<string, LivePrice>;
  distributions?: Record<string, { amount: number; date: string; currency?: string }>;
  allowSorting?: boolean;
  cachedDripData?: Record<string, any>;
  originalRanking?: ScoredETF[]; // Full original ranking to preserve rank numbers
};

export const ETFTable = ({ items, live = {}, distributions = {}, allowSorting = true, cachedDripData = {}, originalRanking = [] }: Props) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<ScoredETF | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [range, setRange] = useState<string>("1Y");
  const [nextDividends, setNextDividends] = useState<Record<string, any>>({});
  const [rsiSignals, setRsiSignals] = useState<Record<string, { signal: string; momentum_1m?: number; momentum_3m?: number; trend_strength?: number }>>({});
  
  // Memoize tickers to prevent unnecessary refetches
  const tickers = useMemo(() => items.map(item => item.ticker), [items]);
  
  // Get ranking history for change indicators
  const { data: rankingChanges = {} } = useRankingHistory(tickers);
  
  // Create original ranking lookup for persistent rank numbers
  const originalRankMap = useMemo(() => {
    const map = new Map<string, number>();
    originalRanking.forEach((etf, index) => {
      map.set(etf.ticker, index + 1);
    });
    return map;
  }, [originalRanking]);
  
  // Fetch RSI signals when tickers change
  useEffect(() => {
    const fetchMomentumSignals = async () => {
      if (tickers.length === 0) return;
      
      try {
        console.log('Fetching momentum signals for', tickers.length, 'tickers');
        const response = await supabase.functions.invoke('momentum-signals', {
          body: { tickers }
        });
        
        if (response.error) {
          console.error('Error fetching momentum signals:', response.error);
          return;
        }
        
        const { signals } = response.data;
        console.log('Received momentum signals for', Object.keys(signals || {}).length, 'tickers');
        setRsiSignals(signals || {});
        
      } catch (error) {
        console.error('Failed to fetch momentum signals:', error);
      }
    };
    
    // Fetch momentum signals with a small delay to avoid rapid calls
    const timeoutId = setTimeout(fetchMomentumSignals, 500);
    return () => clearTimeout(timeoutId);
  }, [tickers]);
  
  // Use the DRIP data passed from parent (includes tax preferences)
  const dripData = cachedDripData;
  const fmtCompact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const DRIPCell = ({ ticker, period }: { ticker: string; period: '4w' | '13w' | '26w' | '52w' }) => {
    const tickerData = dripData[ticker];
    if (!tickerData) {
      // Fallback to live data if available
      const liveItem = live[ticker];
      const periodKey = period as '4w' | '12w' | '52w';
      const d = liveItem?.[`drip${periodKey}Dollar` as keyof LivePrice];
      const p = liveItem?.[`drip${periodKey}Percent` as keyof LivePrice];
      
      if (d == null && p == null) return <span>—</span>;
      
      const up = (p as number ?? 0) >= 0;
      return (
        <div className="inline-flex flex-col items-end leading-tight">
          <span>{d != null ? `${(d as number) >= 0 ? '+' : ''}$${Math.abs(d as number).toFixed(2)}` : "—"}</span>
          <span className={p != null ? (up ? "text-emerald-600 text-xs" : "text-red-600 text-xs") : "text-muted-foreground text-xs"}>
            {p != null ? `${up ? "+" : ""}${(p as number).toFixed(1)}%` : "—"}
          </span>
        </div>
      );
    }
    
    const percentKey = `drip${period}Percent`;
    const dollarKey = `drip${period}Dollar`;
    
    const percent = tickerData[percentKey];
    const dollar = tickerData[dollarKey];
    
    if (percent === undefined || percent === 0) return <span>—</span>;
    
    const up = percent >= 0;
    return (
      <div className="inline-flex flex-col items-end leading-tight">
        <span>{dollar >= 0 ? '+' : '-'}${Math.abs(dollar).toFixed(3)}</span>
        <span className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
          {up ? "+" : ""}{percent.toFixed(1)}%
        </span>
      </div>
    );
  };
  const UNDERLYING_MAP: Record<string, string> = {
    TSLY: "TSLA",
    NVDY: "NVDA",
    APLY: "AAPL",
    AMDY: "AMD",
  };

  function countryFlag(etf: ScoredETF) {
    // Base flag on currency, not country/exchange
    const currency = etf.currency || 'USD';
    if (currency === 'CAD') return "🇨🇦";
    return "🇺🇸";
  }

  function getFundManager(etf: ScoredETF): string {
    if (etf.manager) return etf.manager;
    const n = (etf.name || "").toUpperCase();
    const c = (etf.category || "").toUpperCase();
    if (n.includes("YIELDMAX") || c.includes("YIELDMAX")) return "YieldMax";
    if (n.includes("GLOBAL X")) return "Global X";
    if (n.includes("JPMORGAN") || n.includes("J.P. MORGAN") || n.includes("JP MORGAN")) return "JPMorgan";
    if (n.includes("AMPLIFY")) return "Amplify";
    if (n.includes("ROUNDHILL")) return "Roundhill";
    return "ETF";
  }

  const MANAGER_LOGOS: Record<string, string> = {
    "YIELDMAX": yieldmaxLogo,
    "GLOBAL X": globalxLogo,
    "JPMORGAN": jpmorganLogo,
    "AMPLIFY": amplifyLogo,
    "ROUNDHILL": roundhillLogo,
  };

  function getManagerLogo(etf: ScoredETF, manager?: string): string | undefined {
    const key = (etf.logoKey || manager || etf.manager || "").toUpperCase();
    return MANAGER_LOGOS[key];
  }

  function getEtfDescription(etf: ScoredETF): string {
    if (etf.strategyLabel) return etf.strategyLabel;
    const nm = (etf.name || "").toUpperCase();
    const cat = (etf.category || "").toUpperCase();
    let base = "ETF";
    if (nm.includes("COVERED CALL") || nm.includes("OPTION INCOME") || cat.includes("COVERED CALL") || cat.includes("YIELDMAX")) {
      base = "CC ETF";
    } else if (nm.includes("EQUITY PREMIUM INCOME") || cat.includes("INCOME")) {
      base = "Income ETF";
    }
    const underlying = UNDERLYING_MAP[etf.ticker];
    return underlying ? `${base} - ${underlying}` : base;
  }

  // Helper to clean up ticker display (remove .TO suffix for Canadian funds)
  const displayTicker = (ticker: string) => {
    return ticker.replace(/\.(TO|NE)$/, '');
  }

  // Component for ranking change indicator
  const RankingChangeIndicator = ({ ticker }: { ticker: string }) => {
    const change = rankingChanges[ticker];
    if (!change || change.isNew) return null;
    
    if (change.change === 0) {
      return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
    
    const isImprovement = change.change > 0;
    const Icon = isImprovement ? TrendingUp : TrendingDown;
    const colorClass = isImprovement ? "text-emerald-600" : "text-red-600";
    
    return (
      <div className={`flex items-center gap-1 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs">{Math.abs(change.change)}</span>
      </div>
    );
  };
  // Sorting state and helpers
  type SortKey = "rank" | "ticker" | "price" | "lastDist" | "nextDist" | "drip4w" | "drip13w" | "drip26w" | "drip52w" | "score" | "signal";
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const indicator = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕");
  const requestSort = (key: SortKey) => {
    if (!allowSorting) return; // free users: no sorting changes
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "ticker" ? "asc" : "desc"); }
  };
  const headerBtnClass = allowSorting ? "flex items-center gap-1" : "flex items-center gap-1 opacity-50 pointer-events-none";

  // Percent formatter that preserves negative values
  const formatPct = (v: number, digits = 1) => {
    // Don't use Math.abs() - we need to preserve negative percentages!
    const scaled = Math.abs(v) <= 1 ? v * 100 : v;
    return `${scaled.toFixed(digits)}%`;
  };

  // Helper functions for DRIP calculations
  const getDripPercent = (ticker: string, period: '4w' | '13w' | '26w' | '52w'): number => {
    // First check dripData (from calculate-drip edge function)
    const tickerData = dripData[ticker];
    if (tickerData) {
      const percentKey = `drip${period}Percent`;
      const percent = tickerData[percentKey];
      if (percent !== undefined && percent !== 0) {
        return percent;
      }
    }
    
    // Fallback to live data - map period to correct property names
    const liveItem = live?.[ticker];
    switch (period) {
      case "4w":
        return liveItem?.drip4wPercent ?? 0;
      case "13w":
        return liveItem?.drip13wPercent ?? 0;
      case "26w":
        return liveItem?.drip26wPercent ?? 0;
      case "52w":
        return liveItem?.drip52wPercent ?? 0;
      default:
        return 0;
    }
  };

  const getDripSum = (ticker: string): number => {
    const drip4w = getDripPercent(ticker, "4w");
    const drip13w = getDripPercent(ticker, "13w");
    const drip26w = getDripPercent(ticker, "26w");
    const drip52w = getDripPercent(ticker, "52w");
    
    // Simple sum: 4W% + 13W% + 26W% + 52W% (as number, not percentage)
    return drip4w + drip13w + drip26w + drip52w;
  };

  const rows = useMemo(() => {
    const getVal = (etf: ScoredETF): number | string => {
      // Look up live data using the full ticker (including .TO for Canadian ETFs)
      const lp = live[etf.ticker];
        switch (sortKey) {
          case "ticker": return etf.ticker;
          case "price": return lp?.price ?? Number.NaN;
          case "lastDist": return distributions[etf.ticker]?.amount ?? Number.NaN;
          case "nextDist": return Number.NaN; // Will be handled in a separate component for performance
        case "drip4w": return getDripPercent(etf.ticker, "4w");
        case "drip13w": return getDripPercent(etf.ticker, "13w");
        case "drip26w": return getDripPercent(etf.ticker, "26w");
        case "drip52w": return getDripPercent(etf.ticker, "52w");
        case "score": return getDripSum(etf.ticker); // Use DRIP sum instead of composite score
        case "signal": {
          const momentumSignal = rsiSignals[etf.ticker];
          if (momentumSignal) {
            // Return numeric value for sorting: BUY=2, HOLD=1, SELL=0
            return momentumSignal.signal === 'BUY' ? 2 : (momentumSignal.signal === 'HOLD' ? 1 : 0);
          }
          // Return neutral value when loading
          return 0.5; // Sort loading items in middle
        }
        case "rank":
        default:
          return getDripSum(etf.ticker); // Use DRIP sum as default
      }
    };
    const cmp = (a: ScoredETF, b: ScoredETF) => {
      // Use DRIP sum for default sort (score/rank columns)
      if (sortKey === "score" || sortKey === "rank") {
        const sumA = getDripSum(a.ticker);
        const sumB = getDripSum(b.ticker);
        
        // Sort by DRIP sum descending, then ticker ascending as tiebreaker
        if (sumA !== sumB) {
          return sumB - sumA; // descending
        }
        return a.ticker.localeCompare(b.ticker);
      }
      
      // Single-field sort for other columns
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = typeof av === "number" ? av : Number.NaN;
      const bn = typeof bv === "number" ? bv : Number.NaN;
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
      if (Number.isNaN(an)) return 1;
      if (Number.isNaN(bn)) return -1;
      return sortDir === "asc" ? an - bn : bn - an;
    };
    return [...items].sort(cmp);
  }, [items, sortKey, sortDir, live, dripData]);

  return (
    <Card className="p-4 overflow-x-auto">
      <Table>
        <TableCaption>All high-yield dividend ETFs ranked by risk-aware total return. Live data where available.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <button onClick={() => requestSort("rank")} className={headerBtnClass} aria-disabled={!allowSorting}>
                # <span className="text-muted-foreground text-xs">{indicator("rank")}</span>
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => requestSort("ticker")} className={headerBtnClass} aria-disabled={!allowSorting}>
                Ticker <span className="text-muted-foreground text-xs">{indicator("ticker")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("price")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                Price <span className="text-muted-foreground text-xs">{indicator("price")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("lastDist")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                Last Dist. <span className="text-muted-foreground text-xs">{indicator("lastDist")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("nextDist")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                Next Dist. <span className="text-muted-foreground text-xs">{indicator("nextDist")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip4w")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                4W DRIP <span className="text-muted-foreground text-xs">{indicator("drip4w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip13w")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                13W DRIP <span className="text-muted-foreground text-xs">{indicator("drip13w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip26w")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                26W DRIP <span className="text-muted-foreground text-xs">{indicator("drip26w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip52w")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                52W DRIP <span className="text-muted-foreground text-xs">{indicator("drip52w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("score")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                Score <span className="text-muted-foreground text-xs">{indicator("score")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("signal")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                Signal <span className="text-muted-foreground text-xs">{indicator("signal")}</span>
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((etf, idx) => {
            // Use full ticker for live data lookup (including .TO for Canadian)
            const liveItem = live[etf.ticker];
            const daily = Math.pow(1 + etf.totalReturn1Y / 100, 1 / 365) - 1;
            const ret28dFallback = (Math.pow(1 + daily, 28) - 1) * 100;
            const ret3m = (Math.pow(1 + daily, 90) - 1) * 100;
            const ret1w = (Math.pow(1 + daily, 7) - 1) * 100;
            const ret28d = liveItem?.totalReturn28dPercent ?? ret28dFallback;
            const upWeek = ret1w > 0;
            const buy = ret28d > 0 && ret3m > 0;
            return (
              <TableRow
                key={etf.ticker}
                className={idx < 3 ? "font-semibold cursor-pointer hover:bg-accent" : "cursor-pointer hover:bg-accent"}
                 onClick={() => { 
                   const originalRank = originalRankMap.get(etf.ticker) || idx + 1;
                   setSelected(etf); 
                   setSelectedRank(originalRank); 
                   setRange("1Y"); 
                   setOpen(true); 
                 }}
               >
                 <TableCell>
                   <div className="flex items-center gap-2">
                     <span className="font-mono">{originalRankMap.get(etf.ticker) || idx + 1}</span>
                     <RankingChangeIndicator ticker={etf.ticker} />
                   </div>
                 </TableCell>
                <TableCell>
                  <div className="inline-flex flex-col">
                    <span className="inline-flex items-center">
                      {displayTicker(etf.ticker)} <span className="ml-1" aria-hidden>{countryFlag(etf)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{getFundManager(etf)}</span>
                  </div>
                </TableCell>
                 <TableCell className="text-right">
                   {(() => {
                     // Use full ticker for live data lookup
                     const price = liveItem?.price;
                     const cp = liveItem?.changePercent;
                     
      // Debug logging for MSTY
      if (etf.ticker === 'MSTY') {
        console.log(`🔍 MSTY Debug:`, {
          ticker: etf.ticker,
          dripData: dripData[etf.ticker],
          liveItem,
          dripDataKeys: Object.keys(dripData)
        });
      }
                     
                     if (price == null) return "—";
                    const up = (cp ?? 0) >= 0;
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>${price.toFixed(2)}</span>
                        {cp != null && (
                          <span className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                            {up ? "+" : ""}{cp.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    // Use full ticker for distributions lookup
                    const dist = distributions[etf.ticker];
                    if (!dist) return "—";
                    
                    // Use currency from distribution or default based on ticker
                    const currency = dist.currency || (etf.currency === 'CAD' ? 'CAD' : 'USD');
                    const symbol = currency === 'CAD' ? 'CA$' : '$';
                    
                    const amountStr = `${symbol}${dist.amount.toFixed(3)}`;
                    const dateStr = format(new Date(dist.date), "MM/dd");
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>{amountStr}</span>
                        <span className="text-muted-foreground text-xs">{dateStr}</span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <NextDistributionCell ticker={etf.ticker} />
                </TableCell>
                <TableCell className="text-right">
                  <DRIPCell ticker={etf.ticker} period="4w" />
                </TableCell>
                <TableCell className="text-right">
                  <DRIPCell ticker={etf.ticker} period="13w" />
                </TableCell>
                <TableCell className="text-right">
                  <DRIPCell ticker={etf.ticker} period="26w" />
                </TableCell>
                <TableCell className="text-right">
                  <DRIPCell ticker={etf.ticker} period="52w" />
                </TableCell>
                
                 <TableCell className="text-right font-semibold">
                   {getDripSum(etf.ticker).toFixed(1)}
                 </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const momentumSignal = rsiSignals[etf.ticker];
                    if (momentumSignal) {
                      const { signal, momentum_1m = 0, trend_strength = 0 } = momentumSignal;
                      const badgeClass = signal === 'BUY' ? "bg-emerald-500 text-white" : 
                                        signal === 'SELL' ? "bg-red-500 text-white" : 
                                        "bg-gray-500 text-white";
                      return (
                        <div className="inline-flex flex-col items-end leading-tight">
                          <Badge className={badgeClass}>{signal}</Badge>
                          <span className="text-muted-foreground text-xs">
                            1M: {momentum_1m > 0 ? '+' : ''}{momentum_1m.toFixed(1)}%
                          </span>
                        </div>
                      );
                    }
                    
                    // Show "Loading..." while fetching
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <Badge className="bg-gray-400 text-white">LOADING</Badge>
                        <span className="text-muted-foreground text-xs">Calculating...</span>
                      </div>
                    );
                  })()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`p-0 overflow-hidden ${isMobile ? 'max-w-[95vw] max-h-[90vh] m-4' : 'max-w-4xl'}`}>
          {selected && (
            <div className="w-full overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  {(() => {
                    const manager = getFundManager(selected);
                    const logo = getManagerLogo(selected, manager);
                    return (
                      <>
                        <div className="rounded-full border-2 border-foreground p-1 bg-[hsl(var(--success))]">
                          {logo ? (
                            <img
                              src={logo}
                              alt={`${manager} ETF fund manager logo`}
                              className="h-16 w-16 object-contain rounded-full"
                              loading="lazy"
                            />
                          ) : (
                            <Avatar className="h-16 w-16">
                              <AvatarFallback className="text-xl font-bold">{selected.ticker.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        <div>
                          <div className="text-2xl font-semibold inline-flex items-center gap-2">
                            {displayTicker(selected.ticker)}
                            <span className="ml-1" aria-hidden>{countryFlag(selected)}</span>
                          </div>
                          <div className="text-sm font-medium">{manager} ({selected.exchange})</div>
                          <div className="text-sm text-muted-foreground">{selected.fund || getEtfDescription(selected)}</div>
                        </div>
                      </>
                    );
                  })()}

                </div>
                <div className={`text-right ${isMobile ? 'pr-12' : ''}`}>
                  {selectedRank != null && <div className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-extrabold`}>#{selectedRank}</div>}
                  <div className="text-xs text-muted-foreground">Score: {(selected.compositeScore * 100).toFixed(0)}</div>
                  <div className="mt-1">
                    {(() => {
                      const d = Math.pow(1 + selected.totalReturn1Y / 100, 1 / 365) - 1;
                      const r28dFallback = (Math.pow(1 + d, 28) - 1) * 100;
                      const r3m = (Math.pow(1 + d, 90) - 1) * 100;
                      const r28d = live[selected.ticker]?.totalReturn28dPercent ?? r28dFallback;
                      const buy = r28d > 0 && r3m > 0;
                      return buy ? (
                        <Badge className="bg-emerald-500 text-white">BUY</Badge>
                      ) : (
                        <Badge className="bg-red-500 text-white">SELL</Badge>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className={`${isMobile ? 'p-2 max-h-[60vh] overflow-y-auto' : 'p-4'}`}>
                {/* Distribution History */}
                <DistributionHistory ticker={selected.ticker} />
                <div className={`mt-4 grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'}`}>
                  <div>
                    <div className="text-sm text-muted-foreground">1Y Total Return</div>
                    <div className="text-lg font-medium">{selected.totalReturn1Y ? formatPct(selected.totalReturn1Y, 1) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">AV</div>
                    <div className="text-lg font-medium">{selected.avgVolume ? fmtCompact.format(selected.avgVolume) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Expense Ratio</div>
                    <div className="text-lg font-medium">{selected.expenseRatio ? formatPct(selected.expenseRatio, 2) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Volatility (1Y)</div>
                    <div className="text-lg font-medium">{selected.volatility1Y ? formatPct(selected.volatility1Y, 1) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Max Drawdown (1Y)</div>
                    <div className="text-lg font-medium">{selected.maxDrawdown1Y ? formatPct(selected.maxDrawdown1Y, 1) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">AUM</div>
                    <div className="text-lg font-medium">{selected.aum ? new Intl.NumberFormat("en", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(selected.aum) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Risk Score</div>
                    <div className="text-lg font-medium">{Math.round(selected.riskScore * 100)}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Vol: {Math.round(selected.volNorm * 100)}% | Drawdown: {Math.round(selected.drawdownNorm * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// Separate component for next distribution to avoid performance issues with many queries
const NextDistributionCell = ({ ticker }: { ticker: string }) => {
  const { data: nextDividend } = useQuery({
    queryKey: ['nextDividend', ticker],
    queryFn: async () => {
      // First, check if there are any future dividends already in the database
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('dividends')
        .select('ex_date, pay_date, amount, cash_currency')
        .eq('ticker', ticker)
        .gte('ex_date', today)
        .order('ex_date', { ascending: true })
        .limit(1);
      
      // If we have a future dividend, use it
      if (data?.[0]) {
        return {
          amount: data[0].amount,
          date: data[0].pay_date || data[0].ex_date,
          currency: data[0].cash_currency || 'USD',
          isPrediction: false
        };
      }

      // Otherwise, try to predict the next distribution
      const prediction = await predictNextDistribution(ticker);
      if (prediction) {
        // Get currency from ETF data for predictions
        const { data: etfData } = await supabase
          .from('etfs')
          .select('currency')
          .eq('ticker', ticker)
          .single();
        
        return {
          amount: prediction.amount,
          date: prediction.date,
          currency: etfData?.currency || 'USD',
          isPrediction: true
        };
      }
      
      return null;
    },
    staleTime: 1800_000 // 30 minutes
  });

  if (!nextDividend) return <span>—</span>;
  
  const dateStr = format(new Date(nextDividend.date), "MM/dd");
  const symbol = nextDividend.currency === 'CAD' ? 'CA$' : '$';
  const amountStr = `${symbol}${nextDividend.amount.toFixed(4)}`;
  
  return (
    <div className="inline-flex flex-col items-end leading-tight">
      <span className={nextDividend.isPrediction ? "text-muted-foreground" : ""}>
        {amountStr}
      </span>
      <span className="text-muted-foreground text-xs">
        {dateStr}{nextDividend.isPrediction ? "*" : ""}
      </span>
    </div>
  );
};
