import { useMemo, useState } from "react";
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

import { ComparisonChart, type RangeKey } from "@/components/dashboard/ComparisonChart";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
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
};

export const ETFTable = ({ items, live = {}, distributions = {}, allowSorting = true }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ScoredETF | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [range, setRange] = useState<RangeKey>("1Y");
  const fmtCompact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
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
  // Sorting state and helpers
  type SortKey = "rank" | "ticker" | "price" | "lastDist" | "nextDist" | "drip4w" | "drip12w" | "drip52w" | "yield" | "risk" | "score" | "signal";
  const [sortKey, setSortKey] = useState<SortKey>("drip4w");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const indicator = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕");
  const requestSort = (key: SortKey) => {
    if (!allowSorting) return; // free users: no sorting changes
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "ticker" ? "asc" : "desc"); }
  };
  const headerBtnClass = allowSorting ? "flex items-center gap-1" : "flex items-center gap-1 opacity-50 pointer-events-none";

  // Percent formatter that also handles fractional DB values (e.g., 0.12 -> 12%)
  const formatPct = (v: number, digits = 1) => {
    const scaled = Math.abs(v) <= 1 ? v * 100 : v;
    return `${scaled.toFixed(digits)}%`;
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
          case "drip4w": return lp?.drip4wPercent ?? Number.NaN;
        case "drip12w": return lp?.drip12wPercent ?? Number.NaN;
        case "drip52w": return lp?.drip52wPercent ?? Number.NaN;
        case "yield": { const y = etf.yieldTTM; return Math.abs(y) <= 1 ? y * 100 : y; }
        case "risk": return etf.riskScore;
        case "score": return etf.compositeScore;
        case "signal": {
          const daily = Math.pow(1 + etf.totalReturn1Y / 100, 1 / 365) - 1;
          const r28d = (Math.pow(1 + daily, 28) - 1) * 100;
          const r3m = (Math.pow(1 + daily, 90) - 1) * 100;
          const buy = r28d > 0 && r3m > 0;
          return buy ? 1 : 0;
        }
        case "rank":
        default:
          return etf.compositeScore;
      }
    };
    const cmp = (a: ScoredETF, b: ScoredETF) => {
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
  }, [items, sortKey, sortDir, live]);

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
              <button onClick={() => requestSort("drip12w")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                12W DRIP <span className="text-muted-foreground text-xs">{indicator("drip12w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip52w")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                52W DRIP <span className="text-muted-foreground text-xs">{indicator("drip52w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("yield")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                Yield (TTM) <span className="text-muted-foreground text-xs">{indicator("yield")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("risk")} className={`${headerBtnClass} ml-auto`} aria-disabled={!allowSorting}>
                Risk <span className="text-muted-foreground text-xs">{indicator("risk")}</span>
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
                onClick={() => { setSelected(etf); setSelectedRank(idx + 1); setRange("1Y"); setOpen(true); }}
              >
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center">
                    {displayTicker(etf.ticker)} <span className="ml-1" aria-hidden>{countryFlag(etf)}</span>
                    {upWeek ? (
                      <ArrowUpRight className="ml-1 h-4 w-4 text-emerald-500" aria-label="Up last week" />
                    ) : (
                      <ArrowDownRight className="ml-1 h-4 w-4 text-red-500" aria-label="Down last week" />
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    // Use full ticker for live data lookup
                    const price = liveItem?.price;
                    const cp = liveItem?.changePercent;
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
                  {(() => {
                    const d = liveItem?.drip4wDollar; const p = liveItem?.drip4wPercent;
                    if (d == null && p == null) return "—";
                    const up = (p ?? 0) >= 0;
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>{d != null ? `$${d.toFixed(2)}` : "—"}</span>
                        <span className={p != null ? (up ? "text-emerald-600 text-xs" : "text-red-600 text-xs") : "text-muted-foreground text-xs"}>
                          {p != null ? `${up ? "+" : ""}${p.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const d = liveItem?.drip12wDollar; const p = liveItem?.drip12wPercent;
                    if (d == null && p == null) return "—";
                    const up = (p ?? 0) >= 0;
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>{d != null ? `$${d.toFixed(2)}` : "—"}</span>
                        <span className={p != null ? (up ? "text-emerald-600 text-xs" : "text-red-600 text-xs") : "text-muted-foreground text-xs"}>
                          {p != null ? `${up ? "+" : ""}${p.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const d = liveItem?.drip52wDollar; const p = liveItem?.drip52wPercent;
                    if (d == null && p == null) return "—";
                    const up = (p ?? 0) >= 0;
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>{d != null ? `$${d.toFixed(2)}` : "—"}</span>
                        <span className={p != null ? (up ? "text-emerald-600 text-xs" : "text-red-600 text-xs") : "text-muted-foreground text-xs"}>
                          {p != null ? `${up ? "+" : ""}${p.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">{formatPct(etf.yieldTTM, 1)}</TableCell>
                <TableCell className="text-right">{Math.round(etf.riskScore * 100)}%</TableCell>
                <TableCell className="text-right font-semibold">{(etf.compositeScore * 100).toFixed(0)}</TableCell>
                <TableCell className="text-right">
                  {buy ? (
                    <Badge className="bg-emerald-500 text-white">BUY</Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-500 text-white">SELL</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden">
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
                          <div className="text-sm font-medium">{manager}</div>
                          <div className="text-sm text-muted-foreground">{selected.summary || getEtfDescription(selected)}</div>
                        </div>
                      </>
                    );
                  })()}

                </div>
                <div className="text-right">
                  {selectedRank != null && <div className="text-4xl font-extrabold">#{selectedRank}</div>}
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
              <div className="p-4">
                <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="1M">1M</TabsTrigger>
                    <TabsTrigger value="3M">3M</TabsTrigger>
                    <TabsTrigger value="6M">6M</TabsTrigger>
                    <TabsTrigger value="1Y">1Y</TabsTrigger>
                  </TabsList>
                  <TabsContent value={range} className="mt-4">
                    <ComparisonChart etf={selected} underlyingTicker={UNDERLYING_MAP[selected.ticker]} range={range} />
                  </TabsContent>
                </Tabs>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">1Y Total Return</div>
                    <div className="text-lg font-medium">{formatPct(selected.totalReturn1Y, 1)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Yield (TTM)</div>
                    <div className="text-lg font-medium">{formatPct(selected.yieldTTM, 1)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">AV</div>
                    <div className="text-lg font-medium">{fmtCompact.format(selected.avgVolume)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Expense Ratio</div>
                    <div className="text-lg font-medium">{formatPct(selected.expenseRatio, 2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Volatility (1Y)</div>
                    <div className="text-lg font-medium">{formatPct(selected.volatility1Y, 1)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Max Drawdown (1Y)</div>
                    <div className="text-lg font-medium">{formatPct(selected.maxDrawdown1Y, 1)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">AUM</div>
                    <div className="text-lg font-medium">{new Intl.NumberFormat("en", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(selected.aum)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Risk Score</div>
                    <div className="text-lg font-medium">{Math.round(selected.riskScore * 100)}%</div>
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
