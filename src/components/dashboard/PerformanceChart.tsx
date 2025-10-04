import { Card } from "@/components/ui/card";
import { ScoredETF } from "@/lib/scoring";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";

type Props = { items: ScoredETF[] };

export const PerformanceChart = ({ items }: Props) => {
  return (
    <Card className="p-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="ticker" width={72} />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
            <Legend />
            <Bar dataKey="totalReturn1Y" name="52W Total Return" fill="hsl(var(--sidebar-ring))" radius={[0,4,4,0]}>
              <LabelList dataKey="totalReturn1Y" position="right" formatter={(v: number) => `${v.toFixed(1)}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
