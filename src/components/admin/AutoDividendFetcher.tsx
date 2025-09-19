import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, CheckCircle, AlertTriangle, Database, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AutoDividendFetcher() {
  const [ticker, setTicker] = useState('');
  const [days, setDays] = useState(365);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFetchAll = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      toast.info("Auto-fetching dividends for all active ETFs...");
      
      const { data, error } = await supabase.functions.invoke('auto-dividend-fetcher', {
        body: { days }
      });
      
      if (error) {
        console.error('Auto-fetch error:', error);
        toast.error(`Failed to auto-fetch dividends: ${error.message}`);
      } else {
        console.log('Auto-fetch result:', data);
        setResult(data);
        
        if (data.weekly_collisions?.length > 0) {
          toast.warning(`Success! Found ${data.weekly_collisions.length} weekly collisions to review.`);
        } else {
          toast.success(`Successfully fetched dividends for ${data.processed} ETFs! Inserted ${data.inserted} records.`);
        }
      }
    } catch (error) {
      console.error('Auto-fetch failed:', error);
      toast.error(`Auto dividend fetch failed: ${error.message}`);
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
      toast.info(`Auto-fetching dividends for ${ticker.toUpperCase()}...`);
      
      const { data, error } = await supabase.functions.invoke('auto-dividend-fetcher', {
        body: { ticker: ticker.toUpperCase(), days }
      });
      
      if (error) {
        console.error('Auto-fetch error:', error);
        toast.error(`Failed to auto-fetch dividends: ${error.message}`);
      } else {
        console.log('Auto-fetch result:', data);
        setResult(data);
        
        if (data.weekly_collisions?.length > 0) {
          toast.warning(`Success! Found ${data.weekly_collisions.length} weekly collisions for ${ticker.toUpperCase()}.`);
        } else {
          toast.success(`Successfully fetched ${data.inserted} dividend records for ${ticker.toUpperCase()}!`);
        }
      }
    } catch (error) {
      console.error('Auto-fetch failed:', error);
      toast.error(`Auto dividend fetch failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Auto-Fetch Dividends
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            <strong>Smart Dividend Automation:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Multi-Source</strong>: EODHD (primary) → Yahoo Finance → Alpha Vantage fallbacks</li>
              <li><strong>Duplicate Detection</strong>: Prevents duplicates and detects weekly collisions</li>
              <li><strong>TTM Yield</strong>: Automatically calculates and updates trailing twelve-month yields</li>
              <li><strong>Smart Upsert</strong>: Updates existing records, inserts new ones</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="days">Days of Dividend History</Label>
            <Input
              id="days"
              type="number"
              min="30"
              max="730"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 365)}
              placeholder="365"
            />
          </div>

          <Tabs defaultValue="bulk" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bulk">Bulk Fetch All</TabsTrigger>
              <TabsTrigger value="single">Single ETF</TabsTrigger>
            </TabsList>
            
            <TabsContent value="bulk" className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="font-medium">Auto-Fetch All Active ETFs</span>
              </div>
              <Button
                onClick={handleFetchAll}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                <Database className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
                {loading ? "Auto-Fetching Dividends..." : "Auto-Fetch All ETF Dividends"}
              </Button>
            </TabsContent>

            <TabsContent value="single" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticker">ETF Ticker Symbol</Label>
                <Input
                  id="ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="e.g., MSTY, TSLY, QYLD"
                />
              </div>
              <Button
                onClick={handleFetchSingle}
                disabled={loading || !ticker.trim()}
                variant="outline"
                className="w-full"
              >
                <TrendingUp className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
                {loading ? "Auto-Fetching..." : `Auto-Fetch ${ticker || 'ETF'} Dividends`}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        {result && (
          <div className="mt-6 p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-semibold">Auto-Fetch Results</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div className="space-y-1">
                <p>✅ ETFs Processed: <strong>{result.processed}</strong></p>
                <p>💰 Records Inserted: <strong>{result.inserted}</strong></p>
              </div>
              <div className="space-y-1">
                <p>🔄 Records Updated: <strong>{result.updated}</strong></p>
                {result.errors > 0 && (
                  <p className="text-destructive">⚠️ Errors: <strong>{result.errors}</strong></p>
                )}
              </div>
            </div>

            {/* Weekly Collision Warnings */}
            {result.weekly_collisions && result.weekly_collisions.length > 0 && (
              <Alert className="mb-4 border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-orange-800">
                      ⚠️ Found {result.weekly_collisions.length} Weekly Collisions:
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {result.weekly_collisions.map((collision: any, idx: number) => (
                        <div key={idx} className="text-xs bg-orange-100 p-2 rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-semibold">{collision.ticker}</span>
                            <Badge variant="outline" className="text-orange-700">
                              Week of {collision.week_start}
                            </Badge>
                          </div>
                          <div className="text-orange-600 mt-1">
                            {collision.dividend_count} dividends, Total: ${collision.total_amount.toFixed(4)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-orange-600">
                      Review these manually - they may be legitimate (special dividends) or duplicates from different sources.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Sample Data */}
            {result.sample && result.sample.length > 0 && (
              <div className="mb-4">
                <p className="font-medium text-sm mb-2">Sample fetched dividends:</p>
                <div className="text-xs bg-muted p-3 rounded max-h-32 overflow-y-auto space-y-1">
                  {result.sample.slice(0, 8).map((row: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="font-mono font-semibold">{row.ticker}</span>
                      <span>{row.ex_date}</span>
                      <span className="font-semibold">${row.amount}</span>
                      <Badge variant="secondary" className="text-xs">
                        {row.source}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Details */}
            {result.errorDetails && result.errorDetails.length > 0 && (
              <div>
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