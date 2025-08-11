import { Card } from "@/components/ui/card";
import { ScoredETF } from "@/lib/scoring";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = { items: ScoredETF[] };

export const PerformanceChart = ({ items }: Props) => {
  return (
    <Card className="p-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ticker" />
            <YAxis tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
            <Legend />
            <Bar dataKey="totalReturn1Y" name="1Y Total Return" fill="hsl(var(--sidebar-ring))" radius={[4,4,0,0]} />
            <Bar dataKey="yieldTTM" name="Yield TTM" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
