import { Card } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ScoredETF } from "@/lib/scoring";
import { Line, LineChart, XAxis, YAxis } from "recharts";

export type RangeKey = "1M" | "3M" | "6M" | "1Y";

const RANGE_DAYS: Record<RangeKey, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

const UNDERLYING_SAMPLE_RETURNS: Record<string, number> = {
  TSLA: 35,
  NVDA: 150,
  AAPL: 25,
  AMD: 45,
};

function generateSeries(days: number, etfReturnPct: number, underlyingReturnPct?: number) {
  const etfDaily = Math.pow(1 + etfReturnPct / 100, 1 / 365) - 1;
  const underlyingDaily = underlyingReturnPct != null ? Math.pow(1 + underlyingReturnPct / 100, 1 / 365) - 1 : 0;

  const data: { d: number; etf: number; underlying?: number }[] = [];
  let etfVal = 100;
  let undVal = 100;
  for (let i = days; i >= 0; i--) {
    // prepend oldest first for nicer x-axis
    data.unshift({ d: i, etf: etfVal, underlying: underlyingReturnPct != null ? undVal : undefined });
    etfVal = etfVal * (1 + etfDaily);
    if (underlyingReturnPct != null) undVal = undVal * (1 + underlyingDaily);
  }
  return data.map((p) => {
    if (underlyingReturnPct != null && p.underlying != null) {
      const etfRelative = (p.etf / p.underlying) * 100;
      return { d: p.d, etf: Number(etfRelative.toFixed(2)), underlying: 100 };
    }
    return {
      d: p.d,
      etf: Number((((p.etf / 100) - 1) * 100).toFixed(2)),
      underlying: undefined,
    };
  });
}

type Props = {
  etf: ScoredETF;
  underlyingTicker?: string;
  range: RangeKey;
};

export const ComparisonChart = ({ etf, underlyingTicker, range }: Props) => {
  const days = RANGE_DAYS[range];
  const underlyingReturn = underlyingTicker ? UNDERLYING_SAMPLE_RETURNS[underlyingTicker] : undefined;
  const series = generateSeries(days, etf.totalReturn1Y, underlyingReturn);

  const config = {
    etf: { label: `${etf.ticker} (DRIP)` },
    underlying: { label: underlyingTicker ? `${underlyingTicker}` : "Underlying" },
  } as const;

  return (
    <Card className="p-4">
      <ChartContainer config={config} className="h-72 w-full">
        <LineChart data={series} margin={{ left: 8, right: 28, top: 8, bottom: 0 }}>
          <XAxis hide dataKey="d" />
          <YAxis orientation="right" domain={['auto', 'auto']} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line type="monotone" dataKey="etf" name={`${etf.ticker} (DRIP)`} stroke="hsl(var(--sidebar-ring))" dot={false} strokeWidth={2} />
          {underlyingTicker && (
            <Line type="monotone" dataKey="underlying" name={underlyingTicker} stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
          )}
        </LineChart>
      </ChartContainer>
      <p className="mt-2 text-xs text-muted-foreground">Illustrative series. Connect live data to compare to actual underlying performance and ETF DRIP total return.</p>
    </Card>
  );
};
