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
  const [totalETFs, setTotalETFs] = useState(0);

  const runTest = async () => {
    setTesting(true);
    setResults([]);
    setProgress(0);
    setTotalETFs(0);

    try {
      const wsUrl = `wss://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/etf-stream`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected for Canadian ETF test');
        // Send test message without tickers - will fetch all Canadian ETFs
        ws.send(JSON.stringify({ type: 'test' }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Canadian ETF test message:', message);

        if (message.type === 'connected') {
          console.log('WebSocket connected successfully');
        } else if (message.type === 'progress') {
          if (message.total) {
            setTotalETFs(message.total);
          }
          const progressPercent = message.progress?.percentage || 0;
          setProgress(progressPercent);
        } else if (message.type === 'data') {
          // Add new result for this Canadian ETF
          const newResult: TestResult = {
            ticker: message.ticker,
            country: 'CA',
            status: 'success',
            data: message.data,
            timestamp: new Date().toISOString()
          };
          setResults(prev => [...prev, newResult]);
        } else if (message.type === 'database_updated') {
          console.log('Database updated:', message.message);
        } else if (message.type === 'error') {
          console.error('Canadian ETF test error:', message.message);
          const errorResult: TestResult = {
            ticker: 'ERROR',
            country: 'CA',
            status: 'error',
            error: message.message,
            timestamp: new Date().toISOString()
          };
          setResults(prev => [...prev, errorResult]);
          setTesting(false);
        } else if (message.type === 'complete') {
          console.log('Canadian ETF test complete:', message.message);
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
          <span>Update All Canadian ETF Prices ({totalETFs > 0 ? totalETFs : '?'} ETFs)</span>
          <Button 
            onClick={runTest} 
            disabled={testing}
            className="flex items-center gap-2"
          >
            {testing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {testing ? 'Updating Prices...' : 'Update Canadian ETF Prices'}
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
                          {result.data.price && (
                            <div>Price: ${(() => {
                              const price = typeof result.data.price === 'number' ? result.data.price : parseFloat(result.data.price as string);
                              return !isNaN(price) ? price.toFixed(2) : 'N/A';
                            })()}</div>
                          )}
                          {result.data.yield && (
                            <div>Yield: {(() => {
                              const yieldVal = typeof result.data.yield === 'number' ? result.data.yield : parseFloat(result.data.yield as string);
                              return !isNaN(yieldVal) ? yieldVal.toFixed(2) : 'N/A';
                            })()}%</div>
                          )}
                          {result.data.aum && (
                            <div>AUM: ${(() => {
                              const aum = typeof result.data.aum === 'number' ? result.data.aum : parseFloat(result.data.aum as string);
                              return !isNaN(aum) ? (aum / 1000000).toFixed(0) : 'N/A';
                            })()}M</div>
                          )}
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