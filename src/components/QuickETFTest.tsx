import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Play, Square, CheckCircle, XCircle, Clock } from 'lucide-react';

interface TestResult {
  ticker: string;
  country: string;
  status: 'success' | 'error' | 'pending';
  data?: {
    name?: string;
    price?: number;
    yield?: number;
    aum?: number;
    volume?: number;
    return1y?: number;
  };
  error?: string;
  timestamp: string;
}

const QuickETFTest: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);

  const testTickers = [
    { ticker: 'AAPL', country: 'US' },
    { ticker: 'GOOGL', country: 'US' },
    { ticker: 'MSFT', country: 'US' },
    { ticker: 'NVDA', country: 'US' },
    { ticker: 'TSLA', country: 'US' },
    { ticker: 'SHOP.TO', country: 'CA' },
    { ticker: 'RY.TO', country: 'CA' },
    { ticker: 'TD.TO', country: 'CA' },
    { ticker: 'CNR.TO', country: 'CA' },
    { ticker: 'WEED.TO', country: 'CA' }
  ];

  const runTest = async () => {
    setTesting(true);
    setResults([]);
    setProgress(0);

    // Initialize results with pending status
    const initialResults = testTickers.map(({ ticker, country }) => ({
      ticker,
      country,
      status: 'pending' as const,
      timestamp: new Date().toISOString()
    }));
    setResults(initialResults);

    try {
      const wsUrl = `wss://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/etf-stream`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected for testing');
        ws.send(JSON.stringify({ 
          type: 'test', 
          tickers: testTickers.map(t => t.ticker) 
        }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Test message:', message);

        if (message.type === 'connected') {
          console.log('WebSocket connected successfully');
        } else if (message.type === 'test_data') {
          console.log('Test data received:', message);
        } else if (message.type === 'progress') {
          setProgress((message.current / message.total) * 100);
        } else if (message.type === 'data') {
          setResults(prev => prev.map(result => 
            result.ticker === message.ticker 
              ? {
                  ...result,
                  status: 'success' as const,
                  data: message.data,
                  timestamp: new Date().toISOString()
                }
              : result
          ));
          setProgress(prev => Math.min(prev + 10, 100));
        } else if (message.type === 'error') {
          console.error('Test error:', message.message);
          setResults(prev => prev.map(result => 
            result.status === 'pending'
              ? {
                  ...result,
                  status: 'error' as const,
                  error: message.message,
                  timestamp: new Date().toISOString()
                }
              : result
          ));
          setTesting(false);
        } else if (message.type === 'complete') {
          console.log('Test complete');
          setProgress(100);
          setTesting(false);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setResults(prev => prev.map(result => ({
          ...result,
          status: 'error' as const,
          error: 'WebSocket connection failed'
        })));
        setTesting(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        if (event.code !== 1000) {
          setResults(prev => prev.map(result => ({
            ...result,
            status: 'error' as const,
            error: `Connection closed: ${event.reason || 'Unknown reason'}`
          })));
        }
        setTesting(false);
      };

    } catch (error) {
      console.error('Test setup error:', error);
      setTesting(false);
    }
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>ETF Data Stream Test (10 Stocks)</span>
          <Button 
            onClick={runTest} 
            disabled={testing}
            className="flex items-center gap-2"
          >
            {testing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {testing ? 'Testing...' : 'Run Test'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {testing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-sm text-muted-foreground">Success</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {result.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {result.status === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                    {result.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={result.country === 'US' ? 'default' : 'secondary'}>
                          {result.ticker}
                        </Badge>
                        <span className="text-sm font-medium">{result.country}</span>
                      </div>
                      
                      {result.data && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {result.data.name && <div>Name: {result.data.name}</div>}
                          {result.data.price && <div>Price: ${result.data.price.toFixed(2)}</div>}
                          {result.data.yield && <div>Yield: {result.data.yield.toFixed(2)}%</div>}
                          {result.data.aum && <div>AUM: ${(result.data.aum / 1000000).toFixed(0)}M</div>}
                        </div>
                      )}
                      
                      {result.error && (
                        <div className="text-sm text-red-600 mt-1">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickETFTest;