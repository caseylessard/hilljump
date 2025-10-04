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
  previewMode?: boolean;
  storedScores?: Record<string, any>; // Add stored scores for frozen rankings
  isRankingDataLoaded?: boolean; // Whether ranking data is fully loaded
};

  // Updated ranking change indicator to show actual position changes
  const PersistentRankingChangeIndicator = memo(({ ticker, currentRank, persistentRanking }: { ticker: string; currentRank: number; persistentRanking: Array<{ticker: string, rank: number, score: number, updatedAt: number}> }) => {
    const persistentRank = persistentRanking.find(r => r.ticker === ticker)?.rank;
    if (!persistentRank || persistentRank === currentRank) return null;
    
    const change = persistentRank - currentRank;
    
    // Only show meaningful changes (> 1 position, < 20 positions to avoid noise)
    if (Math.abs(change) <= 1 || Math.abs(change) > 20) return null;
    
    const movedUp = change > 0; // moved to better position (lower number)
    const Icon = movedUp ? TrendingUp : TrendingDown;
    const colorClass = movedUp ? "text-emerald-600" : "text-red-600";
    
    return (
      <div className={`flex items-center gap-1 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs">{Math.abs(change)}</span>
      </div>
    );
  });

// Memoized components for performance
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
  
  // Debug logging removed for performance
  
  // Check if we should show an estimate
  const shouldEstimate = shouldShowEstimate(tickerData, period);
  
  if (!tickerData || shouldEstimate) {
    // First check live data
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
    
    // Show estimate if we have ETF data
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
  
  // Debug logging removed for performance
  
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
  
  // 5-level scheme: filled vs outlined for better readability
  let circleClass: string;
  
  if (position === 2) {
    // Strong Buy - green filled
    circleClass = "bg-emerald-500 border-emerald-500";
  } else if (position === 1) {
    // Buy - green outline only
    circleClass = "bg-transparent border-2 border-emerald-500";
  } else if (position === 0) {
    // Hold - yellow filled  
    circleClass = "bg-yellow-500 border-yellow-500";
  } else if (position === -1) {
    // Sell - red outline only
    circleClass = "bg-transparent border-2 border-red-500";
  } else if (position === -2) {
    // Strong Sell - red filled
    circleClass = "bg-red-500 border-red-500";
  } else {
    // Unknown
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
  taxedScoring = false,
  previewMode = false,
  isRankingDataLoaded = false
}: Props) => {
  // Debug logging removed for performance
  // Performance monitoring
  const performanceMonitor = usePerformanceMonitor(true);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<ScoredETF | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [range, setRange] = useState<string>("1Y");
  
  // Memoize tickers to prevent unnecessary refetches
  const tickers = useMemo(() => items.map(item => item.ticker), [items]);
  
  // Bulk data fetching hooks
  const { data: bulkETFData = {} } = useBulkETFData(tickers);
  const { data: dividendPredictions = {} } = useBulkDividendPredictions(tickers);
  const { data: rankingChanges = {} } = useRankingHistory(tickers);
  
  // Use passed RSI signals instead of fetching again
  
  // Pre-compute lookup tables for performance
  const lookupTables = useMemo(() => {
    const originalRankMap = new Map<string, number>();
    originalRanking.forEach((etf, index) => {
      originalRankMap.set(etf.ticker, index + 1);
    });
    
    // Calculate score-based ranking for consistent rank display
    const scoreBasedRanking = [...items].sort((a, b) => {
      const scoreA = (a.compositeScore || 0);
      const scoreB = (b.compositeScore || 0);
      return scoreB - scoreA; // Highest score first
    });
    
    // Use persistent ranking for consistent rank display
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
      // Use cached DRIP if available, otherwise fallback to estimates
      
      // Check cached DRIP data first - try multiple potential formats
      const tickerData = cachedDripData?.[ticker];
      if (tickerData) {
        // Format 1: Direct percentage properties (PRIORITIZE FOR CONSISTENCY WITH UI)
        const percentKey = `drip${period}Percent`;
        if (typeof tickerData[percentKey] === 'number') {
          return tickerData[percentKey];
        }
        
        // Format 2: ticker.period structure with percentage
        if (tickerData[period] && typeof tickerData[period].percentage === 'number') {
          return tickerData[period].percentage;
        }
        
        // Format 3: Direct period object with growthPercent (FALLBACK ONLY)
        if (tickerData[period] && typeof tickerData[period].growthPercent === 'number') {
          return tickerData[period].growthPercent;
        }
        
        // Format 4: Nested period object with percentage
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
      
      // Fallback to live data
      const liveItem = live?.[ticker];
      let liveValue = 0;
      switch (period) {
        case "4w": liveValue = liveItem?.drip4wPercent ?? 0; break;
        case "13w": liveValue = liveItem?.drip13wPercent ?? 0; break;
        case "26w": liveValue = liveItem?.drip26wPercent ?? 0; break;
        case "52w": liveValue = liveItem?.drip52wPercent ?? 0; break;
      }
      
      if (liveValue !== 0) return liveValue;
      
      // Final fallback: estimate based on ETF fundamentals
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
      // Create a unique cache key that includes the DRIP data source to ensure different tabs have different caches
      const cacheKey = `${ticker}_${Object.keys(cachedDripData).length}_${taxedScoring}`;
      if (dripSumCache.has(cacheKey)) {
        return dripSumCache.get(cacheKey)!;
      }
      
      // Get individual DRIP percentages using the same logic as the individual columns
      const drip4w = getDripPercent(ticker, "4w");
      const drip13w = getDripPercent(ticker, "13w");
      const drip26w = getDripPercent(ticker, "26w");
      const drip52w = getDripPercent(ticker, "52w");
      
      // Debug MSTY specifically - always log for debugging
      if (ticker === 'MSTY') {
        console.log('🔍 MSTY Score Calculation (FIXED):', {
          ticker,
          taxedScoring,
          drip4w,
          drip13w,
          drip26w,
          drip52w,
          sum: drip4w + drip13w + drip26w + drip52w,
          cachedDataKeys: Object.keys(cachedDripData),
          mstyData: cachedDripData[ticker]
        });
      }
      
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
  
  // Optimized constants
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
  
  // Helper functions (memoized)
  const helperFunctions = useMemo(() => ({
    // Safe number formatting function
    safeToFixed: (value: any, digits: number = 2): string => {
      if (value === null || value === undefined || value === '') return "—";
      const num = typeof value === 'number' ? value : Number(value);
      if (isNaN(num)) return "—";
      return num.toFixed(digits);
    },
    
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
      } else if (nm.includes("EQUITY PREMIUM INCOME") || cat.includes("INCOME")) {
        base = "Income ETF";
      }
      const underlying = constants.UNDERLYING_MAP[etf.ticker as keyof typeof constants.UNDERLYING_MAP];
      return underlying ? `${base} - ${underlying}` : base;
    },
    
    displayTicker: (ticker: string) => ticker.replace(/\.(TO|NE)$/, '')
  }), [constants]);
  
  // Sorting state with localStorage persistence
  type SortKey = "rank" | "ticker" | "price" | "lastDist" | "nextDist" | "drip4w" | "drip13w" | "drip26w" | "drip52w" | "score" | "signal";
  
  const getInitialSort = (): { key: SortKey; dir: "asc" | "desc" } => {
    // Always default to score sorting (highest first)
    return { key: "score", dir: "desc" };
  };
  
  const initialSort = getInitialSort();
  const [sortKey, setSortKey] = useState<SortKey>(initialSort.key);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSort.dir);
  
  const indicator = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕");
  
  const requestSort = useCallback((key: SortKey) => {
    if (!allowSorting) return;
    
    let newSortKey = key;
    let newSortDir: "asc" | "desc";
    
    if (sortKey === key) {
      newSortDir = sortDir === "asc" ? "desc" : "asc";
    } else { 
      newSortKey = key; 
      newSortDir = key === "ticker" ? "asc" : "desc"; 
    }
    
    setSortKey(newSortKey);
    setSortDir(newSortDir);
    
    try {
      localStorage.setItem("etf-table-sort", JSON.stringify({ 
        key: newSortKey, 
        dir: newSortDir 
      }));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [allowSorting, sortKey, sortDir]);
  
  // Optimized sorting with memoization
  const sortedRows = useMemo(() => {
    const getVal = (etf: ScoredETF): number | string => {
      const lp = live[etf.ticker];
      switch (sortKey) {
        case "ticker": return etf.ticker;
        case "price": return lp?.price ?? Number.NaN;
        case "lastDist": return distributions[etf.ticker]?.amount ?? Number.NaN;
        case "nextDist": return Number.NaN;
        case "drip4w": return lookupTables.getDripPercent(etf.ticker, "4w");
        case "drip13w": return lookupTables.getDripPercent(etf.ticker, "13w");
        case "drip26w": return lookupTables.getDripPercent(etf.ticker, "26w");
        case "drip52w": return lookupTables.getDripPercent(etf.ticker, "52w");
        case "score": return lookupTables.getDripSum(etf.ticker);
        case "signal": return etf.position === 2 ? 4 : etf.position === 1 ? 3 : etf.position === 0 ? 2 : etf.position === -1 ? 1 : 0;
        case "rank":
        default: return lookupTables.getDripSum(etf.ticker);
      }
    };
    
    const cmp = (a: ScoredETF, b: ScoredETF) => {
      if (sortKey === "score" || sortKey === "rank") {
        const scoreA = lookupTables.getDripSum(a.ticker);
        const scoreB = lookupTables.getDripSum(b.ticker);
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // descending
        }
        return a.ticker.localeCompare(b.ticker);
      }
      
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
    
    
    return items.sort(cmp);
  }, [items, sortKey, sortDir, live, distributions, lookupTables, rsiSignals]);
  
  const headerBtnClass = allowSorting ? "flex items-center gap-1" : "flex items-center gap-1 opacity-50 pointer-events-none";
  
  // Navigation helpers
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

  // Keyboard navigation
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

  return (
    <Card className="p-4 overflow-x-auto">
      <Table className="etf-table">
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
            const ret3m = (Math.pow(1 + daily, 90) - 1) * 100;
            const ret1w = (Math.pow(1 + daily, 7) - 1) * 100;
            const ret28d = liveItem?.totalReturn28dPercent ?? ret28dFallback;
            
            // Calculate DRIP sum for this ticker using lookupTables
            const dripSum = lookupTables.getDripSum(etf.ticker);
            
            // Preview mode: replace sensitive data with placeholders for ranks 1-3 and 7+
            const shouldObfuscate = previewMode && (idx <= 2 || idx >= 6);
            
            // Create obfuscated data
            const displayTicker = shouldObfuscate ? "SIGN IN" : etf.ticker;
            const displayName = shouldObfuscate ? "***" : etf.name;
            const displayPrice = shouldObfuscate ? "***" : (liveItem?.price || Number(cachedPrices[etf.ticker] || etf.current_price || 0));
            const displayDripSum = shouldObfuscate ? "***" : dripSum;
            const displayRank = idx + 1; // Always show rank
            
            return (
              <TableRow
                key={shouldObfuscate ? `obfuscated-${idx}` : etf.ticker}
                className={`${idx < 3 ? "font-semibold" : ""} ${shouldObfuscate ? "" : "cursor-pointer hover:bg-accent"}`}
                onClick={() => { 
                  if (shouldObfuscate) return; // Prevent clicks on obfuscated rows
                  const originalRank = lookupTables.originalRankMap.get(etf.ticker) || idx + 1;
                  setSelected(etf); 
                  setSelectedRank(originalRank); 
                  setRange("1Y"); 
                  setOpen(true); 
                }}
              >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isRankingDataLoaded ? (
                        <>
                          <span className="font-mono">{displayRank}</span>
                          {!shouldObfuscate && <PersistentRankingChangeIndicator ticker={etf.ticker} currentRank={idx + 1} persistentRanking={persistentRanking} />}
                        </>
                      ) : (
                        <div className="w-8 h-5 bg-muted animate-pulse rounded" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex flex-col">
                      <span className="inline-flex items-center">
                        {displayTicker} 
                        {shouldObfuscate ? (
                          <img 
                            src="/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png" 
                            alt="HillJump" 
                            className="w-4 h-4 ml-1 rounded" 
                          />
                        ) : (
                          <span className="ml-1" aria-hidden>{helperFunctions.countryFlag(etf)}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{shouldObfuscate ? "***" : helperFunctions.getFundManager(etf)}</span>
                    </div>
                  </TableCell>
                   <TableCell className="text-center">
                     <TrendIndicator position={etf.position} />
                   </TableCell>
                    <TableCell className="text-right">
                      {shouldObfuscate ? "***" : (() => {
                      const price = liveItem?.price;
                      const cp = liveItem?.changePercent;
                      
                      if (price == null) return "—";
                      const up = (cp ?? 0) >= 0;
                      
                      // Get price update date from cached prices
                      const cachedPrice = cachedPrices[etf.ticker];
                      const priceDate = cachedPrice?.priceUpdatedAt;
                      const dateStr = priceDate ? format(new Date(priceDate), "MM/dd HH:mm") : "";
                      
                      return (
                        <div className="inline-flex flex-col items-end leading-tight">
                          <span>${price.toFixed(2)}</span>
                          <div className="text-xs space-y-0">
                            {cp != null && (
                              <div className={up ? "text-emerald-600" : "text-red-600"}>
                                {up ? "+" : ""}{cp.toFixed(2)}%
                              </div>
                            )}
                            {dateStr && (
                              <div className="text-muted-foreground">
                                {dateStr}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </TableCell>
                   <TableCell className="text-right">
                     {shouldObfuscate ? "***" : (() => {
                     const dist = distributions[etf.ticker];
                     if (!dist) return "—";
                     
                     const currency = dist.currency || (etf.currency === 'CAD' ? 'CAD' : 'USD');
                     const symbol = currency === 'CAD' ? 'CA$' : '$';
                     
                     const amountStr = `${symbol}${dist.amount.toFixed(3)}`;
                     const [year, month, day] = dist.date.split('-').map(Number);
                     const localDate = new Date(year, month - 1, day);
                     const dateStr = format(localDate, "MM/dd");
                     return (
                       <div className="inline-flex flex-col items-end leading-tight">
                         <span>{amountStr}</span>
                         <span className="text-muted-foreground text-xs">{dateStr}</span>
                       </div>
                     );
                   })()}
                 </TableCell>
                 <TableCell className="text-right">
                   {shouldObfuscate ? "***" : <NextDistributionCell ticker={etf.ticker} predictions={dividendPredictions} />}
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
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigateToETF('prev')}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/80"
                    aria-label="Previous ETF"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                      <img 
                        src={helperFunctions.getManagerLogo(selected) || "/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png"}
                        alt={helperFunctions.getManagerLogo(selected) ? "Manager logo" : "HillJump logo"}
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = "/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png";
                        }}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold">{helperFunctions.displayTicker(selected.ticker)}</h3>
                        <span>{helperFunctions.countryFlag(selected)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{helperFunctions.getFundManager(selected)}</p>
                    </div>
                  </div>
                </div>
                  
                <button
                  onClick={() => navigateToETF('next')}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/80"
                  aria-label="Next ETF"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Fund, Strategy, and Underlying Info */}
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex gap-4 flex-wrap">
                  <span><strong>Fund:</strong> {selected.name || 'Unknown'}</span>
                  <span><strong>Strategy:</strong> {selected.strategyLabel || selected.category || 'Unknown'}</span>
                  <span><strong>Underlying:</strong> {selected.underlying || constants.UNDERLYING_MAP[selected.ticker as keyof typeof constants.UNDERLYING_MAP] || 'Unknown'}</span>
                </div>
              </div>

              {/* Simple Stats Box */}
              <Card>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Current Price</div>
                      <div className="font-semibold">
                        {(() => {
                          const livePrice = live[selected.ticker]?.price;
                          const cachedPrice = cachedPrices[selected.ticker];
                          const price = livePrice || cachedPrice?.price || selected.current_price;
                          return price ? `$${Number(price).toFixed(2)}` : "—";
                        })()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">52W DRIP Return</div>
                      <div className="font-semibold">
                        {(() => {
                          const drip52w = lookupTables.getDripPercent(selected.ticker, "52w");
                          return drip52w !== 0 ? `${drip52w >= 0 ? '+' : ''}${drip52w.toFixed(1)}%` : "—";
                        })()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">DRIP Score</div>
                      <div className="font-semibold">
                        {lookupTables.getDripSum(selected.ticker).toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              
              <DistributionHistory ticker={selected.ticker} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};