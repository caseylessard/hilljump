import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Distribution {
  id: string;
  amount: number;
  ex_date: string;
  pay_date?: string;
  cash_currency: string;
}

interface Props {
  ticker: string;
}

export const DistributionHistory = ({ ticker }: Props) => {
  const { data: distributions, isLoading } = useQuery({
    queryKey: ['distributions', ticker],
    queryFn: async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const { data, error } = await supabase
        .from('dividends')
        .select('id, amount, ex_date, pay_date, cash_currency')
        .eq('ticker', ticker)
        .gte('ex_date', oneYearAgo.toISOString().split('T')[0])
        .order('ex_date', { ascending: false })
        .limit(52); // Max 52 weeks

      if (error) throw error;
      return data as Distribution[];
    },
    enabled: !!ticker
  });

  const totalDistributions = distributions?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
  const averageDistribution = distributions?.length ? totalDistributions / distributions.length : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Distribution History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Distribution History (Last 12 Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {distributions && distributions.length > 0 ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Paid</div>
                <div className="text-lg font-semibold">
                  ${totalDistributions.toFixed(4)}
                </div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Average Payment</div>
                <div className="text-lg font-semibold">
                  ${averageDistribution.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Distribution List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {distributions.map((distribution) => (
                <div 
                  key={distribution.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        ${Number(distribution.amount).toFixed(4)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {distribution.cash_currency}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-xs">
                      Ex: {new Date(distribution.ex_date).toLocaleDateString()}
                    </Badge>
                    {distribution.pay_date && (
                      <Badge variant="secondary" className="text-xs">
                        Pay: {new Date(distribution.pay_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {distributions.length >= 52 && (
              <div className="mt-3 text-xs text-muted-foreground text-center">
                Showing last 52 distributions (max 12 months)
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No distribution data available for the last 12 months</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};