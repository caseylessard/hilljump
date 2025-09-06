import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DataFreshness {
  ticker: string;
  lastDividendDate: string;
  daysSinceUpdate: number;
  isStale: boolean;
  totalDividends: number;
}

interface SystemHealth {
  lastUpdateTime: string;
  totalProcessed: number;
  newDividendsFound: number;
  status: 'success' | 'warning' | 'error';
  errors: number;
}

export const DividendDataMonitor = () => {
  const [freshnessData, setFreshnessData] = useState<DataFreshness[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const fetchMonitoringData = async () => {
    try {
      // Get data freshness for key tickers
      const { data: freshnessResults, error: freshnessError } = await supabase.rpc(
        'check_dividend_freshness'
      );

      if (freshnessError) {
        console.error('Freshness check failed, using fallback query');
        // Fallback: Manual query for data freshness
        const { data: dividendData } = await supabase
          .from('dividends')
          .select('ticker, ex_date, created_at')
          .in('ticker', ['MSTY', 'TSLY', 'NVYY', 'CONY', 'QQQY', 'YMAX', 'YMAG'])
          .order('ex_date', { ascending: false });

        if (dividendData) {
          const freshnessMap = new Map();
          dividendData.forEach(dividend => {
            if (!freshnessMap.has(dividend.ticker)) {
              const daysSince = Math.floor(
                (Date.now() - new Date(dividend.ex_date).getTime()) / (1000 * 60 * 60 * 24)
              );
              freshnessMap.set(dividend.ticker, {
                ticker: dividend.ticker,
                lastDividendDate: dividend.ex_date,
                daysSinceUpdate: daysSince,
                isStale: daysSince > 35, // Monthly dividends should be < 35 days
                totalDividends: 1
              });
            }
          });
          setFreshnessData(Array.from(freshnessMap.values()));
        }
      } else {
        setFreshnessData(freshnessResults || []);
      }

      // Get system health from latest update log
      const { data: logData } = await supabase
        .from('dividend_update_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (logData) {
        setSystemHealth({
          lastUpdateTime: logData.end_time || logData.created_at,
          totalProcessed: logData.total_etfs || 0,
          newDividendsFound: logData.inserted_events || 0,
          status: logData.status === 'completed' ? 
            (logData.inserted_events || 0) > 0 ? 'success' : 'warning' : 'error',
          errors: logData.error_message ? 1 : 0
        });
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualUpdate = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke('dividend-updater', {
        body: { manual: true }
      });

      if (error) throw error;

      toast({
        title: "Update Triggered",
        description: "Manual dividend update has been started. Check back in a few minutes.",
      });

      // Refresh data after a short delay
      setTimeout(() => {
        fetchMonitoringData();
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || 'Failed to trigger manual update',
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchMonitoringData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (isStale: boolean) => {
    return isStale ? 'destructive' : 'secondary';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading monitoring data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {systemHealth && getStatusIcon(systemHealth.status)}
            Dividend Update System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {systemHealth ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Last Update</div>
                <div className="font-medium">
                  {new Date(systemHealth.lastUpdateTime).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">ETFs Processed</div>
                <div className="font-medium">{systemHealth.totalProcessed}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">New Dividends</div>
                <div className="font-medium">{systemHealth.newDividendsFound}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge variant={systemHealth.status === 'success' ? 'default' : 
                  systemHealth.status === 'warning' ? 'secondary' : 'destructive'}>
                  {systemHealth.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">No system health data available</div>
          )}
          
          <div className="mt-4 flex gap-2">
            <Button 
              onClick={triggerManualUpdate} 
              disabled={updating}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
              {updating ? 'Updating...' : 'Manual Update'}
            </Button>
            <Button 
              onClick={fetchMonitoringData}
              variant="ghost"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Freshness Monitor */}
      <Card>
        <CardHeader>
          <CardTitle>High-Yield ETF Data Freshness</CardTitle>
          <CardDescription>
            Monitoring data staleness for frequently distributing ETFs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {freshnessData.length > 0 ? (
            <div className="space-y-3">
              {freshnessData.map((item) => (
                <div key={item.ticker} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{item.ticker}</div>
                    <div className="text-sm text-muted-foreground">
                      Last dividend: {new Date(item.lastDividendDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(item.isStale)}>
                      {item.daysSinceUpdate} days ago
                    </Badge>
                    {item.isStale && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">No monitoring data available</div>
          )}

          {freshnessData.some(item => item.isStale) && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Some ETFs have stale dividend data (&gt;35 days). Consider using manual entry or 
                checking alternative data sources.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};