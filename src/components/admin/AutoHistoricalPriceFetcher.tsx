import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Download, TrendingUp, CheckCircle, AlertCircle, Database } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AutoHistoricalPriceFetcher() {
  const [ticker, setTicker] = useState('');
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFetchAll = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      toast.info("Fetching historical data for all active ETFs with EODHD symbols...");
      
      const { data, error } = await supabase.functions.invoke('fetch-historical-prices-auto', {
        body: { days }
      });
      
      if (error) {
        console.error('Fetch error:', error);
        toast.error(`Failed to fetch historical data: ${error.message}`);
      } else {
        console.log('Fetch result:', data);
        setResult(data);
        toast.success(`Successfully fetched data for ${data.processed} ETFs! Inserted ${data.inserted} price records.`);
      }
    } catch (error) {
      console.error('Fetch failed:', error);
      toast.error(`Historical data fetch failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSingle = async () => {
    if (!ticker.trim()) {
      toast.error('Please enter a ticker symbol');
      return;
    }

    setLoading(true);
    setResult(null);
    
    try {
      toast.info(`Fetching historical data for ${ticker.toUpperCase()}...`);
      
      const { data, error } = await supabase.functions.invoke('fetch-historical-prices-auto', {
        body: { ticker: ticker.toUpperCase(), days }
      });
      
      if (error) {
        console.error('Fetch error:', error);
        toast.error(`Failed to fetch historical data: ${error.message}`);
      } else {
        console.log('Fetch result:', data);
        setResult(data);
        toast.success(`Successfully fetched ${data.inserted} price records for ${ticker.toUpperCase()}!`);
      }
    } catch (error) {
      console.error('Fetch failed:', error);
      toast.error(`Historical data fetch failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Auto-Fetch Historical Prices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            <strong>Automated Data Fetching:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>EODHD API</strong>: Primary source for ETFs with configured symbols</li>
              <li><strong>Yahoo Finance</strong>: Fallback for other ETFs (free but rate-limited)</li>
              <li><strong>Data Range</strong>: Fetches last 90 days by default</li>
              <li><strong>Upsert Logic</strong>: Updates existing records, inserts new ones</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="days">Days of Historical Data</Label>
            <Input
              id="days"
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 90)}
              placeholder="90"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Fetch All Active ETFs</span>
            </div>
            <Button
              onClick={handleFetchAll}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <Database className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? "Fetching Historical Data..." : "Fetch All ETFs Historical Data"}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or fetch single ETF</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">ETF Ticker Symbol</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g., QYLD, RYLD, MSTY"
              />
            </div>
            <Button
              onClick={handleFetchSingle}
              disabled={loading || !ticker.trim()}
              variant="outline"
              className="w-full"
            >
              <Download className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? "Fetching..." : `Fetch ${ticker || 'ETF'} Historical Data`}
            </Button>
          </div>
        </div>

        {result && (
          <div className="mt-6 p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-semibold">Fetch Results</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p>✅ ETFs Processed: <strong>{result.processed}</strong></p>
                <p>📊 Records Inserted: <strong>{result.inserted}</strong></p>
              </div>
              <div>
                <p>🔄 Records Updated: <strong>{result.updated}</strong></p>
                {result.errors > 0 && (
                  <p className="text-destructive">⚠️ Errors: <strong>{result.errors}</strong></p>
                )}
              </div>
            </div>

            {result.sample && result.sample.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-sm mb-2">Sample fetched data:</p>
                <div className="text-xs bg-muted p-3 rounded max-h-32 overflow-y-auto">
                  {result.sample.slice(0, 5).map((row: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span className="font-mono">{row.ticker}</span>
                      <span>{row.date}</span>
                      <span className="font-semibold">${row.close_price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errorDetails && result.errorDetails.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-sm mb-2 text-destructive">Error Details:</p>
                <div className="text-xs bg-destructive/10 p-3 rounded max-h-32 overflow-y-auto">
                  {result.errorDetails.map((error: string, idx: number) => (
                    <div key={idx} className="text-destructive">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}