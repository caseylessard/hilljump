import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  ticker: string;
}

interface ChartDataPoint {
  date: string;
  price: number;
  priceWithDistributions?: number;
  distributionAmount?: number;
  formattedDate: string;
}

export function PerformanceChartWithDistributions({ ticker }: Props) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const { data: historicalData, isLoading } = useQuery({
    queryKey: ['performance-chart-52w', ticker],
    queryFn: async () => {
      const today = new Date();
      const startDate = subDays(today, 365); // 52 weeks

      // Fetch historical prices
      const { data: prices, error: priceError } = await supabase
        .from('historical_prices')
        .select('date, close_price')
        .eq('ticker', ticker)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (priceError) throw priceError;

      // Fetch distributions in the last 52 weeks
      const { data: distributions, error: distError } = await supabase
        .from('dividends')
        .select('ex_date, amount')
        .eq('ticker', ticker)
        .gte('ex_date', startDate.toISOString().split('T')[0])
        .order('ex_date', { ascending: true });

      if (distError) throw distError;

      return { prices: prices || [], distributions: distributions || [] };
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  useEffect(() => {
    if (!historicalData) return;

    const { prices, distributions } = historicalData;

    if (prices.length === 0) {
      setChartData([]);
      return;
    }

    // Create a map of distributions by ex_date
    const distMap = new Map(
      distributions.map(d => [d.ex_date, d.amount])
    );

    // Build chart data with opening price, distribution points, and today's price
    const dataPoints: ChartDataPoint[] = [];
    
    // Starting point (52 weeks ago)
    if (prices.length > 0) {
      const openingPrice = prices[0].close_price;
      dataPoints.push({
        date: prices[0].date,
        price: openingPrice,
        priceWithDistributions: openingPrice,
        formattedDate: format(new Date(prices[0].date), 'MMM dd, yyyy')
      });
    }

    // Add distribution points
    let cumulativeDistributions = 0;
    distributions.forEach(dist => {
      cumulativeDistributions += dist.amount;
      
      // Find the price on or before the ex_date
      const priceOnDate = prices.find(p => p.date === dist.ex_date) || 
                         prices.filter(p => p.date <= dist.ex_date).slice(-1)[0];
      
      if (priceOnDate) {
        dataPoints.push({
          date: dist.ex_date,
          price: priceOnDate.close_price,
          priceWithDistributions: priceOnDate.close_price + cumulativeDistributions,
          distributionAmount: dist.amount,
          formattedDate: format(new Date(dist.ex_date), 'MMM dd, yyyy')
        });
      }
    });

    // Today's price (ending point)
    if (prices.length > 0) {
      const todayPrice = prices[prices.length - 1].close_price;
      dataPoints.push({
        date: prices[prices.length - 1].date,
        price: todayPrice,
        priceWithDistributions: todayPrice + cumulativeDistributions,
        formattedDate: format(new Date(prices[prices.length - 1].date), 'MMM dd, yyyy')
      });
    }

    setChartData(dataPoints);
  }, [historicalData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">52-Week Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading chart data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">52-Week Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const startPrice = chartData[0]?.price || 0;
  const endPrice = chartData[chartData.length - 1]?.price || 0;
  const endPriceWithDist = chartData[chartData.length - 1]?.priceWithDistributions || 0;
  const totalReturn = ((endPriceWithDist - startPrice) / startPrice) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>52-Week Performance + Distributions</span>
          <span className={`text-sm font-medium ${totalReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM yy')}
            />
            <YAxis 
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload as ChartDataPoint;
                return (
                  <div className="bg-background border rounded p-2 shadow-lg">
                    <p className="text-sm font-medium">{data.formattedDate}</p>
                    <p className="text-sm">Price: ${data.price.toFixed(2)}</p>
                    {data.priceWithDistributions !== undefined && (
                      <p className="text-sm text-emerald-600">
                        +Distributions: ${data.priceWithDistributions.toFixed(2)}
                      </p>
                    )}
                    {data.distributionAmount !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Distribution: ${data.distributionAmount.toFixed(4)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
              name="Price"
            />
            <Line 
              type="monotone" 
              dataKey="priceWithDistributions" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              dot={false}
              name="Price + Distributions"
            />
            {/* Mark distribution points */}
            {chartData.map((point, idx) => 
              point.distributionAmount ? (
                <ReferenceDot
                  key={idx}
                  x={point.date}
                  y={point.priceWithDistributions}
                  r={4}
                  fill="hsl(var(--chart-3))"
                  stroke="none"
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Shows price movement over 52 weeks with cumulative distributions added</p>
        </div>
      </CardContent>
    </Card>
  );
}
