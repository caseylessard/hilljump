import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScoredETF } from "@/lib/scoring";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import heroInvesting from "@/assets/hero-investing.jpg";
import { ComparisonChart, type RangeKey } from "@/components/dashboard/ComparisonChart";

type Props = { items: ScoredETF[] };

export const ETFTable = ({ items }: Props) => {
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
            <TableHead className="w-12">#</TableHead>
            <TableHead>Ticker</TableHead>
            <TableHead className="text-right">1Y Total Return</TableHead>
            <TableHead className="text-right">Yield (TTM)</TableHead>
            <TableHead className="text-right">AV</TableHead>
            <TableHead className="text-right">Risk</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((etf, idx) => (
            <TableRow
              key={etf.ticker}
              className={idx < 3 ? "font-semibold cursor-pointer hover:bg-accent" : "cursor-pointer hover:bg-accent"}
              onClick={() => { setSelected(etf); setSelectedRank(idx + 1); setRange("1Y"); setOpen(true); }}
            >
              <TableCell>{idx + 1}</TableCell>
              <TableCell>{etf.ticker}</TableCell>
              <TableCell className="text-right">{etf.totalReturn1Y.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{etf.yieldTTM.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{fmtCompact.format(etf.avgVolume)}</TableCell>
              <TableCell className="text-right">{Math.round(etf.riskScore * 100)}%</TableCell>
              <TableCell className="text-right font-semibold">{(etf.compositeScore * 100).toFixed(0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden">
          {selected && (
            <div className="w-full">
              <div className="relative">
                <img src={heroInvesting} alt={`${selected.ticker} dividend reinvestment background`} className="h-36 w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-background/20" />
                <div className="absolute inset-0 flex items-end justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 ring-2 ring-border">
                      <AvatarFallback className="text-xl font-bold">{selected.ticker.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-2xl font-semibold">{selected.ticker}</div>
                      <div className="text-sm text-muted-foreground">{selected.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-extrabold">{(selected.compositeScore * 100).toFixed(0)}</div>
                    {selectedRank != null && <div className="text-xs text-muted-foreground">Rank #{selectedRank}</div>}
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
