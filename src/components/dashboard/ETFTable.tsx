import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoredETF } from "@/lib/scoring";

type Props = { items: ScoredETF[] };

export const ETFTable = ({ items }: Props) => {
  return (
    <Card className="p-4 overflow-x-auto">
      <Table>
        <TableCaption>Top 100 high-yield dividend ETFs ranked by risk-aware total return. Data is illustrative.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Ticker</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">1Y Total Return</TableHead>
            <TableHead className="text-right">Yield (TTM)</TableHead>
            <TableHead className="text-right">Avg Volume</TableHead>
            <TableHead className="text-right">Expense</TableHead>
            <TableHead className="text-right">Risk</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((etf, idx) => (
            <TableRow key={etf.ticker}>
              <TableCell className="font-medium">{idx + 1}</TableCell>
              <TableCell>{etf.ticker}</TableCell>
              <TableCell className="truncate max-w-[280px]">{etf.name}</TableCell>
              <TableCell className="text-right">{etf.totalReturn1Y.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{etf.yieldTTM.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{Intl.NumberFormat().format(etf.avgVolume)}</TableCell>
              <TableCell className="text-right">{etf.expenseRatio.toFixed(2)}%</TableCell>
              <TableCell className="text-right">{Math.round(etf.riskScore * 100)}%</TableCell>
              <TableCell className="text-right font-semibold">{(etf.compositeScore * 100).toFixed(0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
