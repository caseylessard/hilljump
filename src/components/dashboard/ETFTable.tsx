import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoredETF } from "@/lib/scoring";

type Props = { items: ScoredETF[] };

export const ETFTable = ({ items }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ScoredETF | null>(null);
  const fmtCompact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
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
              onClick={() => { setSelected(etf); setOpen(true); }}
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
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.ticker} — {selected.name}</DialogTitle>
                <DialogDescription>{selected.category || "ETF"}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
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
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">Composite Score</div>
                  <div className="text-lg font-semibold">{(selected.compositeScore * 100).toFixed(0)}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
