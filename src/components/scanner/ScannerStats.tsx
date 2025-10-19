import { Card, CardContent } from '@/components/ui/card';

interface ScannerStatsProps {
  totalAnalyzed: number;
  qualifiedSignals: number;
  avgConviction: number;
  avgRR: number;
}

export function ScannerStats({
  totalAnalyzed,
  qualifiedSignals,
  avgConviction,
  avgRR,
}: ScannerStatsProps) {
  const stats = [
    {
      label: 'Analyzed',
      value: totalAnalyzed,
      color: 'text-primary',
    },
    {
      label: 'Qualified',
      value: qualifiedSignals,
      color: 'text-emerald-500',
    },
    {
      label: 'Avg Conv.',
      value: `${avgConviction}%`,
      color: 'text-violet-500',
    },
    {
      label: 'Avg R:R',
      value: `${avgRR}:1`,
      color: 'text-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardContent className="pt-6 text-center">
            <div className={`text-3xl md:text-4xl font-bold mb-2 ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
