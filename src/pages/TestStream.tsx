import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, Database, Clock, Zap } from 'lucide-react';
import { useETFStream } from '@/hooks/useETFStream';
import ETFStreamPanel from '@/components/admin/ETFStreamPanel';

const TestStreamPage: React.FC = () => {
  const [testResults, setTestResults] = React.useState<any[]>([]);

  const testSampleStocks = async () => {
    console.log('Testing WebSocket stream with sample stocks...');
    
    // Test stocks: mix of US and Canadian
    const testTickers = [
      'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', // US stocks
      'SHOP.TO', 'RY.TO', 'TD.TO', 'CNR.TO', 'WEED.TO' // Canadian stocks
    ];
    
    const results: any[] = [];
    
    // Create WebSocket connection
    const wsUrl = `wss://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/etf-stream`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected for testing');
      ws.send(JSON.stringify({ type: 'test', tickers: testTickers }));
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Test message received:', message);
      
      if (message.type === 'data') {
        results.push({
          ticker: message.ticker,
          country: message.ticker.includes('.TO') ? 'CA' : 'US',
          data: message.data,
          timestamp: new Date().toISOString()
        });
        setTestResults([...results]);
      } else if (message.type === 'complete') {
        ws.close();
        console.log('Test complete:', results);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket test error:', error);
    };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">ETF Data Stream Testing</h1>
        <p className="text-muted-foreground">Test WebSocket streaming vs traditional cron jobs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Cron Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 border rounded-lg">
                <div className="font-medium">dividend-updater-daily</div>
                <div className="text-sm text-muted-foreground">Schedule: 0 6 * * * (Daily at 6 AM)</div>
                <Badge variant="outline" className="mt-1">Active</Badge>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="font-medium">fetch-etf-data-every-5min</div>
                <div className="text-sm text-muted-foreground">Schedule: */5 * * * * (Every 5 minutes)</div>
                <Badge variant="outline" className="mt-1">Active</Badge>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Recommendation:</strong> The 5-minute cron job can be removed if WebSocket streaming works reliably.
                Keep the daily dividend updater for scheduled maintenance.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              WebSocket Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={testSampleStocks} className="w-full">
                Test 10 Sample Stocks
              </Button>
              
              {testResults.length > 0 && (
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {testResults.map((result, index) => (
                      <div key={index} className="p-2 border rounded text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant={result.country === 'US' ? 'default' : 'secondary'}>
                              {result.ticker} ({result.country})
                            </Badge>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Price: ${result.data.price?.toFixed(2) || 'N/A'}
                              {result.data.yield && ` | Yield: ${result.data.yield.toFixed(2)}%`}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ETFStreamPanel />

      <Card>
        <CardHeader>
          <CardTitle>Data Update Frequency Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-green-600">Real-time (WebSocket)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use for on-demand updates when users actively view data. 
                Cost-effective as you only pay for actual usage.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-blue-600">Hourly Cron</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Good for background updates of core metrics. 
                Balances freshness with API cost control.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-purple-600">Daily Cron</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Perfect for dividend data and fundamental metrics 
                that don't change frequently.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestStreamPage;