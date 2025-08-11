import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScoredETF } from "@/lib/scoring";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { ComparisonChart, type RangeKey } from "@/components/dashboard/ComparisonChart";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LivePrice } from "@/lib/live";
type Props = { items: ScoredETF[]; live?: Record<string, LivePrice> };

export const ETFTable = ({ items, live = {} }: Props) => {
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
  return (
    <Card className="p-4 overflow-x-auto">
      <Table>
        <TableCaption>Top 100 high-yield dividend ETFs ranked by risk-aware total return. Data is illustrative.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <button onClick={() => requestSort("rank")} className="flex items-center gap-1">
                # <span className="text-muted-foreground text-xs">{indicator("rank")}</span>
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => requestSort("ticker")} className="flex items-center gap-1">
                Ticker <span className="text-muted-foreground text-xs">{indicator("ticker")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("price")} className="flex items-center gap-1 ml-auto">
                Price <span className="text-muted-foreground text-xs">{indicator("price")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip4w")} className="flex items-center gap-1 ml-auto">
                4W DRIP <span className="text-muted-foreground text-xs">{indicator("drip4w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip12w")} className="flex items-center gap-1 ml-auto">
                12W DRIP <span className="text-muted-foreground text-xs">{indicator("drip12w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("drip52w")} className="flex items-center gap-1 ml-auto">
                52W DRIP <span className="text-muted-foreground text-xs">{indicator("drip52w")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("yield")} className="flex items-center gap-1 ml-auto">
                Yield (TTM) <span className="text-muted-foreground text-xs">{indicator("yield")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("risk")} className="flex items-center gap-1 ml-auto">
                Risk <span className="text-muted-foreground text-xs">{indicator("risk")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("score")} className="flex items-center gap-1 ml-auto">
                Score <span className="text-muted-foreground text-xs">{indicator("score")}</span>
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => requestSort("signal")} className="flex items-center gap-1 ml-auto">
                Signal <span className="text-muted-foreground text-xs">{indicator("signal")}</span>
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((etf, idx) => {
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
                    {etf.ticker} <span className="text-muted-foreground ml-1">({etf.exchange})</span>
                    {upWeek ? (
                      <ArrowUpRight className="ml-1 h-4 w-4 text-emerald-500" aria-label="Up last week" />
                    ) : (
                      <ArrowDownRight className="ml-1 h-4 w-4 text-red-500" aria-label="Down last week" />
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const price = live[etf.ticker]?.price;
                    const cp = live[etf.ticker]?.changePercent;
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
                    const d = liveItem?.drip4wDollar; const p = liveItem?.drip4wPercent;
                    if (d == null || p == null) return "—";
                    const up = p >= 0;
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>${d.toFixed(2)}</span>
                        <span className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>{up ? "+" : ""}{p.toFixed(1)}%</span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const d = liveItem?.drip12wDollar; const p = liveItem?.drip12wPercent;
                    if (d == null || p == null) return "—";
                    const up = p >= 0;
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>${d.toFixed(2)}</span>
                        <span className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>{up ? "+" : ""}{p.toFixed(1)}%</span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const d = liveItem?.drip52wDollar; const p = liveItem?.drip52wPercent;
                    if (d == null || p == null) return "—";
                    const up = p >= 0;
                    return (
                      <div className="inline-flex flex-col items-end leading-tight">
                        <span>${d.toFixed(2)}</span>
                        <span className={up ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>{up ? "+" : ""}{p.toFixed(1)}%</span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">{etf.yieldTTM.toFixed(1)}%</TableCell>
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
                  <div className="rounded-full border-2 border-foreground p-1">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-xl font-bold">{selected.ticker.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{selected.ticker}</div>
                    <div className="text-sm text-muted-foreground">{selected.name}</div>
                  </div>
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
                    <div className="text-lg font-medium">{selected.totalReturn1Y.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Yield (TTM)</div>
                    <div className="text-lg font-medium">{selected.yieldTTM.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">AV</div>
                    <div className="text-lg font-medium">{fmtCompact.format(selected.avgVolume)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Expense Ratio</div>
                    <div className="text-lg font-medium">{selected.expenseRatio.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Volatility (1Y)</div>
                    <div className="text-lg font-medium">{selected.volatility1Y.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Max Drawdown (1Y)</div>
                    <div className="text-lg font-medium">{selected.maxDrawdown1Y.toFixed(1)}%</div>
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
