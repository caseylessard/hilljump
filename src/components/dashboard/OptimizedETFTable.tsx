import { useMemo, useState, useEffect, memo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScoredETF } from "@/lib/scoring";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { DistributionHistory } from "@/components/dashboard/DistributionHistory";
import { ArrowUpRight, ArrowDownRight, X, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import type { LivePrice } from "@/lib/live";
import yieldmaxLogo from "@/assets/logos/yieldmax.png";
import globalxLogo from "@/assets/logos/globalx.png";
import jpmorganLogo from "@/assets/logos/jpmorgan.png";
import amplifyLogo from "@/assets/logos/amplify.png";
import roundhillLogo from "@/assets/logos/roundhill.svg";
import { useBulkETFData, useBulkDividendPredictions, useBulkRSISignals } from "@/hooks/useBulkETFData";
import { useRankingHistory, type RankingChange } from "@/hooks/useRankingHistory";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { estimateQuickDrip, shouldShowEstimate } from "@/lib/dripEstimator";
import { MobileETFTable } from "./MobileETFTable";

type Props = {
  items: ScoredETF[];
  live?: Record<string, LivePrice>;
  distributions?: Record<string, { amount: number; date: string; currency?: string }>;
  allowSorting?: boolean;
  cachedDripData?: Record<string, any>;
  rsiSignals?: Record<string, any>;
  originalRanking?: ScoredETF[];
  persistentRanking?: Array<{ticker: string, rank: number, score: number, updatedAt: number}>;
  cachedPrices?: Record<string, any>;
  frozenRankings?: Map<string, number>;
  taxedScoring?: boolean;
};

const PersistentRankingChangeIndicator = memo(({ ticker, currentRank, persistentRanking }: { ticker: string; currentRank: number; persistentRanking: Array<{ticker: string, rank: number, score: number, updatedAt: number}> }) => {
  const persistentRank = persistentRanking.find(r => r.ticker === ticker)?.rank;
  if (!persistentRank || persistentRank === currentRank) return null;
  
  const change = persistentRank - currentRank;
  
  if (Math.abs(change) <= 1 || Math.abs(change) > 20) return null;
  
  const movedUp = change > 0;
  const Icon = movedUp ? TrendingUp : TrendingDown;
  const colorClass = movedUp ? "text-emerald-600" : "text-red-600";
  
  return (
    <div className={`flex items-center gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs">{Math.abs(change)}</span>
    </div>
  );
});

const RankingChangeIndicator = memo(({ ticker, changes }: { ticker: string; changes: Record<string, RankingChange> }) => {
  const change = changes[ticker];
  if (!change || change.isNew || !change.previousRank || Math.abs(change.change) > 50) return null;
  
  if (change.change === 0) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  
  const movedUp = change.change > 0;
  const Icon = movedUp ? TrendingUp : TrendingDown;
  const colorClass = movedUp ? "text-emerald-600" : "text-red-600";
  
  return (
    <div className={`flex items-center gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs">{Math.abs(change.change)}</span>
    </div>
  );
});

const DRIPCell = memo(({ 
  ticker, 
  period, 
  dripData, 
  live,
  etfData
}: { 
  ticker: string; 
  period: '4w' | '13w' | '26w' | '52w'; 
  dripData: Record<string, any>; 
  live: Record<string, LivePrice>; 
  etfData?: ScoredETF;
}) => {
  const tickerData = dripData[ticker];
  
  const shouldEstimate = shouldShowEstimate(tickerData, period);
  
  if (!tickerData || shouldEstimate) {
    const liveItem = live[ticker];
    const periodKey = period as '4w' | '12w' | '52w';
    const d = liveItem?.[`drip${periodKey}Dollar` as keyof LivePrice];
    const p = liveItem?.[`drip${periodKey}Percent` as keyof LivePrice];
    
    if (d != null || p != null) {
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
    
    if (etfData) {
      const estimate = estimateQuickDrip({
        current_price: etfData.current_price,
        yield_ttm: etfData.yieldTTM,
        total_return_1y: etfData.totalReturn1Y
      }, period);
      
      if (estimate.estimatedDrip !== 0) {
        const up = estimate.estimatedDrip >= 0;
        return (
          <div className="inline-flex flex-col items-end leading-tight">
            <Badge 
              variant="outline" 
              className="text-xs px-1 py-0 h-4 text-muted-foreground border-muted-foreground/30"
              title={estimate.note}
            >
              est
            </Badge>
            <span className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
              {up ? "+" : ""}{estimate.estimatedDrip.toFixed(1)}%
            </span>
          </div>
        );
      }
    }
    
    return <span>—</span>;
  }
  
  const percentKey = `drip${period}Percent`;
  const dollarKey = `drip${period}Dollar`;
  
  const percent = tickerData?.[percentKey];
  const dollar = tickerData?.[dollarKey];
  
  if (percent === undefined || percent === null) return <span>—</span>;
  
  const up = percent >= 0;
  return (
    <div className="inline-flex flex-col items-end leading-tight">
      <span>{dollar >= 0 ? '+' : '-'}${Math.abs(dollar).toFixed(3)}</span>
      <span className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
        {up ? "+" : ""}{percent.toFixed(1)}%
      </span>
    </div>
  );
});

const NextDistributionCell = memo(({ 
  ticker, 
  predictions 
}: { 
  ticker: string; 
  predictions: Record<string, any>; 
}) => {
  const prediction = predictions[ticker];
  
  if (!prediction) return <span>—</span>;
  
  const dateStr = format(new Date(prediction.date), "MM/dd");
  const symbol = prediction.currency === 'CAD' ? 'CA$' : '$';
  const amountStr = `${symbol}${prediction.amount.toFixed(4)}`;
  
  return (
    <div className="inline-flex flex-col items-end leading-tight">
      <span className="text-muted-foreground">{amountStr}</span>
      <span className="text-muted-foreground text-xs">{dateStr}*</span>
    </div>
  );
});

const TrendIndicator = memo(({ position }: { position?: number }) => {
  if (position === undefined || position === null) {
    return (
      <div className="flex justify-center">
        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
      </div>
    );
  }
  
  let circleClass: string;
  
  if (position === 2) {
    circleClass = "bg-emerald-500 border-emerald-500";
  } else if (position === 1) {
    circleClass = "bg-transparent border-2 border-emerald-500";
  } else if (position === 0) {
    circleClass = "bg-yellow-500 border-yellow-500";
  } else if (position === -1) {
    circleClass = "bg-transparent border-2 border-red-500";
  } else if (position === -2) {
    circleClass = "bg-red-500 border-red-500";
  } else {
    circleClass = "bg-muted-foreground border-muted-foreground";
  }
  
  return (
    <div className="flex justify-center">
      <div className={`w-3 h-3 rounded-full border ${circleClass}`} />
    </div>
  );
});

export const OptimizedETFTable = ({ 
  items, 
  live = {}, 
  distributions = {}, 
  allowSorting = true, 
  cachedDripData = {}, 
  rsiSignals = {},
  originalRanking = [],
  persistentRanking = [],
  cachedPrices = {},
  frozenRankings = new Map(),
  taxedScoring = false
}: Props) => {
  const performanceMonitor = usePerformanceMonitor(true);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<ScoredETF | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [range, setRange] = useState<string>("1Y");
  const [sortKey, setSortKey] = useState<string>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  
  const tickers = useMemo(() => items.map(item => item.ticker), [items]);
  
  const { data: bulkETFData = {} } = useBulkETFData(tickers);
  const { data: dividendPredictions = {} } = useBulkDividendPredictions(tickers);
  const { data: rankingChanges = {} } = useRankingHistory(tickers);
  
  const lookupTables = useMemo(() => {
    const originalRankMap = new Map<string, number>();
    originalRanking.forEach((etf, index) => {
      originalRankMap.set(etf.ticker, index + 1);
    });
    
    const scoreBasedRanking = [...items].sort((a, b) => {
      const scoreA = (a.compositeScore || 0);
      const scoreB = (b.compositeScore || 0);
      return scoreB - scoreA;
    });
    
    const persistentRankMap = new Map<string, number>();
    persistentRanking.forEach(item => {
      persistentRankMap.set(item.ticker, item.rank);
    });
    
    const scoreRankMap = new Map<string, number>();
    scoreBasedRanking.forEach((etf, index) => {
      scoreRankMap.set(etf.ticker, index + 1);
    });
    
    const dripSumCache = new Map<string, number>();
    const getDripPercent = (ticker: string, period: '4w' | '13w' | '26w' | '52w'): number => {
      const tickerData = cachedDripData?.[ticker];
      if (tickerData) {
        const percentKey = `drip${period}Percent`;
        if (typeof tickerData[percentKey] === 'number') {
          return tickerData[percentKey];
        }
        
        if (tickerData[period] && typeof tickerData[period].percentage === 'number') {
          return tickerData[period].percentage;
        }
        
        if (tickerData[period] && typeof tickerData[period].growthPercent === 'number') {
          return tickerData[period].growthPercent;
        }
        
        if (tickerData[period] && typeof tickerData[period] === 'object') {
          const periodData = tickerData[period];
          if (typeof periodData.percentage === 'number') {
            return periodData.percentage;
          }
          if (typeof periodData.growthPercent === 'number') {
            return periodData.growthPercent;
          }
        }
      }
      
      const liveItem = live?.[ticker];
      let liveValue = 0;
      switch (period) {
        case "4w": liveValue = liveItem?.drip4wPercent ?? 0; break;
        case "13w": liveValue = liveItem?.drip13wPercent ?? 0; break;
        case "26w": liveValue = liveItem?.drip26wPercent ?? 0; break;
        case "52w": liveValue = liveItem?.drip52wPercent ?? 0; break;
      }
      
      if (liveValue !== 0) return liveValue;
      
      const etf = originalRanking?.find(e => e.ticker === ticker);
      if (etf) {
        const estimate = estimateQuickDrip({
          current_price: etf.current_price,
          yield_ttm: etf.yieldTTM,
          total_return_1y: etf.totalReturn1Y
        }, period);
        return estimate.estimatedDrip;
      }
      
      return 0;
    };
    
    const getDripSum = (ticker: string): number => {
      const cacheKey = `${ticker}_${Object.keys(cachedDripData).length}_${taxedScoring}`;
      if (dripSumCache.has(cacheKey)) {
        return dripSumCache.get(cacheKey)!;
      }
      
      const drip4w = getDripPercent(ticker, "4w");
      const drip13w = getDripPercent(ticker, "13w");
      const drip26w = getDripPercent(ticker, "26w");
      const drip52w = getDripPercent(ticker, "52w");
      
      const sum = drip4w + drip13w + drip26w + drip52w;
      
      dripSumCache.set(cacheKey, sum);
      return sum;
    };
    
    return {
      originalRankMap,
      persistentRankMap,
      scoreRankMap,
      getDripPercent,
      getDripSum,
      dripSumCache
    };
  }, [originalRanking, cachedDripData, live, items.length, taxedScoring]);
  
  const constants = useMemo(() => ({
    UNDERLYING_MAP: { TSLY: "TSLA", NVDY: "NVDA", APLY: "AAPL", AMDY: "AMD" },
    MANAGER_LOGOS: {
      "YIELDMAX": yieldmaxLogo,
      "GLOBAL X": globalxLogo,
      "JPMORGAN": jpmorganLogo,
      "AMPLIFY": amplifyLogo,
      "ROUNDHILL": roundhillLogo,
    },
    fmtCompact: new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }),
    formatPct: (v: number, digits = 1) => {
      const scaled = Math.abs(v) <= 1 ? v * 100 : v;
      return `${scaled.toFixed(digits)}%`;
    }
  }), []);
  
  const helperFunctions = useMemo(() => ({
    countryFlag: (etf: ScoredETF) => {
      const currency = etf.currency || 'USD';
      return currency === 'CAD' ? "🇨🇦" : "🇺🇸";
    },
    
    getFundManager: (etf: ScoredETF): string => {
      if (etf.manager) return etf.manager;
      const n = (etf.name || "").toUpperCase();
      const c = (etf.category || "").toUpperCase();
      if (n.includes("YIELDMAX") || c.includes("YIELDMAX")) return "YieldMax";
      if (n.includes("GLOBAL X")) return "Global X";
      if (n.includes("JPMORGAN") || n.includes("J.P. MORGAN") || n.includes("JP MORGAN")) return "JPMorgan";
      if (n.includes("AMPLIFY")) return "Amplify";
      if (n.includes("ROUNDHILL")) return "Roundhill";
      return "ETF";
    },
    
    getManagerLogo: (etf: ScoredETF, manager?: string): string | undefined => {
      const key = (etf.logoKey || manager || etf.manager || "").toUpperCase();
      return constants.MANAGER_LOGOS[key as keyof typeof constants.MANAGER_LOGOS];
    },
    
    getEtfDescription: (etf: ScoredETF): string => {
      if (etf.strategyLabel) return etf.strategyLabel;
      const nm = (etf.name || "").toUpperCase();
      const cat = (etf.category || "").toUpperCase();
      let base = "ETF";
      if (nm.includes("COVERED CALL") || nm.includes("OPTION INCOME") || cat.includes("COVERED CALL") || cat.includes("YIELDMAX")) {
        base = "CC ETF";
      }
      return base;
    },

    displayTicker: (ticker: string): string => {
      const underlying = constants.UNDERLYING_MAP[ticker as keyof typeof constants.UNDERLYING_MAP];
      return underlying ? `${ticker} (${underlying})` : ticker;
    }
  }), [constants]);

  const requestSort = useCallback((key: string) => {
    if (!allowSorting) return;
    
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [allowSorting, sortKey, sortDir]);

  const indicator = useCallback((key: string) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? "↑" : "↓";
  }, [sortKey, sortDir]);

  const sortedRows = useMemo(() => {
    const cmp = (a: ScoredETF, b: ScoredETF): number => {
      let av: any, bv: any;
      
      switch (sortKey) {
        case "rank":
          av = frozenRankings.get(a.ticker) ?? 999;
          bv = frozenRankings.get(b.ticker) ?? 999;
          break;
        case "ticker":
          av = a.ticker;
          bv = b.ticker;
          break;
        case "signal":
          av = a.position ?? 0;
          bv = b.position ?? 0;
          break;
        case "price":
          av = cachedPrices[a.ticker] || a.current_price || 0;
          bv = cachedPrices[b.ticker] || b.current_price || 0;
          break;
        case "lastDist":
          av = distributions[a.ticker]?.amount || 0;
          bv = distributions[b.ticker]?.amount || 0;
          break;
        case "nextDist":
          av = dividendPredictions[a.ticker]?.amount || 0;
          bv = dividendPredictions[b.ticker]?.amount || 0;
          break;
        case "drip4w":
          av = lookupTables.getDripPercent(a.ticker, "4w");
          bv = lookupTables.getDripPercent(b.ticker, "4w");
          break;
        case "drip13w":
          av = lookupTables.getDripPercent(a.ticker, "13w");
          bv = lookupTables.getDripPercent(b.ticker, "13w");
          break;
        case "drip26w":
          av = lookupTables.getDripPercent(a.ticker, "26w");
          bv = lookupTables.getDripPercent(b.ticker, "26w");
          break;
        case "drip52w":
          av = lookupTables.getDripPercent(a.ticker, "52w");
          bv = lookupTables.getDripPercent(b.ticker, "52w");
          break;
        case "score":
          av = lookupTables.getDripSum(a.ticker);
          bv = lookupTables.getDripSum(b.ticker);
          break;
        default:
          return 0;
      }
      
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
    
    return items.sort(cmp);
  }, [items, sortKey, sortDir, live, distributions, lookupTables, rsiSignals]);
  
  const headerBtnClass = allowSorting ? "flex items-center gap-1" : "flex items-center gap-1 opacity-50 pointer-events-none";
  
  const currentIndex = useMemo(() => {
    if (!selected) return -1;
    return sortedRows.findIndex(item => item.ticker === selected.ticker);
  }, [selected, sortedRows]);

  const navigateToETF = useCallback((direction: 'prev' | 'next') => {
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : sortedRows.length - 1;
    } else {
      newIndex = currentIndex < sortedRows.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newETF = sortedRows[newIndex];
    const newRank = lookupTables.originalRankMap.get(newETF.ticker) || newIndex + 1;
    setSelected(newETF);
    setSelectedRank(newRank);
    setRange("1Y");
  }, [currentIndex, sortedRows, lookupTables.originalRankMap]);

  const handlePrevious = () => navigateToETF('prev');
  const handleNext = () => navigateToETF('next');
  
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < sortedRows.length - 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open || !selected) return;
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateToETF('prev');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToETF('next');
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, selected, navigateToETF]);

  if (isMobile) {
    return (
      <>
        <MobileETFTable
          items={sortedRows}
          live={live}
          distributions={distributions}
          cachedDripData={cachedDripData}
          cachedPrices={cachedPrices}
          frozenRankings={frozenRankings}
          persistentRanking={persistentRanking}
          onItemClick={(etf, rank) => {
            const originalRank = lookupTables.originalRankMap.get(etf.ticker) || rank;
            setSelected(etf);
            setSelectedRank(originalRank);
            setRange("1Y");
            setOpen(true);
          }}
        />
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-4">
            {selected && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{helperFunctions.countryFlag(selected)}</span>
                    <div>
                      <h2 className="text-xl font-bold">{selected.ticker}</h2>
                      <p className="text-sm text-muted-foreground">{helperFunctions.getEtfDescription(selected)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {(() => {
                      const manager = helperFunctions.getFundManager(selected);
                      const logo = helperFunctions.getManagerLogo(selected, manager);
                      return (
                        <div className="flex items-center gap-2">
                          {logo && (
                            <Avatar className="h-6 w-6">
                              <img src={logo} alt={manager} className="object-contain" />
                              <AvatarFallback className="text-xs">{manager.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="text-sm font-medium">{manager}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/20 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold">${(cachedPrices[selected.ticker] || selected.current_price || 0).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">Price</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{constants.formatPct(selected.yieldTTM || 0)}</div>
                    <div className="text-xs text-muted-foreground">Yield</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{constants.formatPct(selected.totalReturn1Y || 0)}</div>
                    <div className="text-xs text-muted-foreground">1Y Return</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{constants.fmtCompact.format(selected.aum || 0)}</div>
                    <div className="text-xs text-muted-foreground">AUM</div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={handlePrevious}
                    disabled={!hasPrevious}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-accent disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  
                  <span className="text-sm text-muted-foreground">
                    #{selectedRank} of {items.length}
                  </span>
                  
                  <button
                    onClick={handleNext}
                    disabled={!hasNext}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-accent disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <DistributionHistory ticker={selected.ticker} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
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
              <TableHead className="text-center">
                <button onClick={() => requestSort("signal")} className={`${headerBtnClass} mx-auto`} aria-disabled={!allowSorting}>
                  Trend <span className="text-muted-foreground text-xs">{indicator("signal")}</span>
                </button>
                <div className="flex justify-center gap-1 mt-1">
                  <div className="flex items-center gap-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">B</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-xs text-muted-foreground">H</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-muted-foreground">S</span>
                  </div>
                </div>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((etf, idx) => {
              const liveItem = live[etf.ticker];
              const daily = Math.pow(1 + etf.totalReturn1Y / 100, 1 / 365) - 1;
              const ret28dFallback = (Math.pow(1 + daily, 28) - 1) * 100;
              const ret28d = liveItem?.totalReturn28dPercent ?? ret28dFallback;
              
              return (
                <TableRow
                  key={etf.ticker}
                  className={idx < 3 ? "font-semibold cursor-pointer hover:bg-accent" : "cursor-pointer hover:bg-accent"}
                  onClick={() => { 
                    const originalRank = lookupTables.originalRankMap.get(etf.ticker) || idx + 1;
                    setSelected(etf); 
                    setSelectedRank(originalRank); 
                    setRange("1Y"); 
                    setOpen(true); 
                  }}
                >
                   <TableCell>
                     <div className="flex items-center gap-2">
                       <span className="font-mono">{frozenRankings.get(etf.ticker) || idx + 1}</span>
                       <PersistentRankingChangeIndicator ticker={etf.ticker} currentRank={idx + 1} persistentRanking={persistentRanking} />
                     </div>
                   </TableCell>
                  <TableCell>
                    <div className="inline-flex flex-col">
                      <span className="inline-flex items-center">
                        {helperFunctions.displayTicker(etf.ticker)} <span className="ml-1" aria-hidden>{helperFunctions.countryFlag(etf)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{helperFunctions.getFundManager(etf)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <TrendIndicator position={etf.position} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <div className="inline-flex flex-col items-end">
                      <span>${(cachedPrices[etf.ticker] || etf.current_price || 0).toFixed(2)}</span>
                      <span className={`text-xs ${ret28d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {ret28d >= 0 ? '+' : ''}{ret28d.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {distributions[etf.ticker] ? (
                      <div className="inline-flex flex-col items-end">
                        <span>${distributions[etf.ticker].amount.toFixed(4)}</span>
                        <span className="text-xs text-muted-foreground">
                          {distributions[etf.ticker].date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(distributions[etf.ticker].date)) : "—"}
                        </span>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <NextDistributionCell ticker={etf.ticker} predictions={dividendPredictions} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DRIPCell ticker={etf.ticker} period="4w" dripData={cachedDripData} live={live} etfData={etf} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DRIPCell ticker={etf.ticker} period="13w" dripData={cachedDripData} live={live} etfData={etf} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DRIPCell ticker={etf.ticker} period="26w" dripData={cachedDripData} live={live} etfData={etf} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DRIPCell ticker={etf.ticker} period="52w" dripData={cachedDripData} live={live} etfData={etf} />
                  </TableCell>
                   <TableCell className="text-right font-mono">
                     <div className="inline-flex flex-col items-end">
                       <span className="font-semibold">
                         {lookupTables.getDripSum(etf.ticker).toFixed(1)}
                       </span>
                     </div>
                   </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{helperFunctions.countryFlag(selected)}</span>
                  <div>
                    <h2 className="text-2xl font-bold">{selected.ticker}</h2>
                    <p className="text-muted-foreground">{helperFunctions.getEtfDescription(selected)}</p>
                  </div>
                </div>
                
                <div className="ml-auto flex items-center gap-2">
                  {(() => {
                    const manager = helperFunctions.getFundManager(selected);
                    const logo = helperFunctions.getManagerLogo(selected, manager);
                    return (
                      <div className="flex items-center gap-2">
                        {logo && (
                          <Avatar className="h-8 w-8">
                            <img src={logo} alt={manager} className="object-contain" />
                            <AvatarFallback className="text-sm">{manager.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                        )}
                        <span className="font-medium">{manager}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6 p-4 bg-muted/20 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">${(cachedPrices[selected.ticker] || selected.current_price || 0).toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Current Price</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{constants.formatPct(selected.yieldTTM || 0)}</div>
                  <div className="text-sm text-muted-foreground">Yield TTM</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{constants.formatPct(selected.totalReturn1Y || 0)}</div>
                  <div className="text-sm text-muted-foreground">1Y Return</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{constants.fmtCompact.format(selected.aum || 0)}</div>
                  <div className="text-sm text-muted-foreground">AUM</div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={handlePrevious}
                  disabled={!hasPrevious}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-accent disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    #{selectedRank} of {items.length}
                  </span>
                  <Tabs value={range} onValueChange={setRange}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="3M">3M</TabsTrigger>
                      <TabsTrigger value="6M">6M</TabsTrigger>
                      <TabsTrigger value="1Y">1Y</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-accent disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4">
                <DistributionHistory ticker={selected.ticker} />
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">1Y Total Return</div>
                  <div className="text-lg font-medium">{selected.totalReturn1Y ? constants.formatPct(selected.totalReturn1Y, 1) : "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">AV</div>
                  <div className="text-lg font-medium">{selected.avgVolume ? constants.fmtCompact.format(selected.avgVolume) : "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Expense Ratio</div>
                  <div className="text-lg font-medium">{selected.expenseRatio ? constants.formatPct(selected.expenseRatio, 2) : "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Volatility (1Y)</div>
                  <div className="text-lg font-medium">{selected.volatility1Y ? constants.formatPct(selected.volatility1Y, 1) : "—"}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};