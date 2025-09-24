import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const StalePriceUpdater: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const updateStalePrices = async () => {
    setIsUpdating(true);
    setResult(null);
    
    try {
      toast.info('Finding ETFs with stale prices...');
      
      // Get ETFs with prices older than 1 day
      const { data: staleETFs, error: queryError } = await supabase
        .from('etfs')
        .select('ticker, current_price, price_updated_at, exchange')
        .eq('active', true)
        .lt('price_updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (queryError) {
        throw new Error(`Failed to query stale ETFs: ${queryError.message}`);
      }
      
      if (!staleETFs || staleETFs.length === 0) {
        toast.success('No stale prices found - all ETFs are up to date!');
        setResult({ success: true, message: 'All ETF prices are current', count: 0 });
        return;
      }
      
      const staleTickers = staleETFs.map(etf => etf.ticker);
      toast.info(`Found ${staleTickers.length} ETFs with stale prices. Updating...`);
      
      // Call the quotes function to update these specific tickers
      const { data, error } = await supabase.functions.invoke('quotes', {
        body: { tickers: staleTickers }
      });
      
      if (error) {
        throw new Error(`Price update failed: ${error.message}`);
      }
      
      const pricesUpdated = data?.prices ? Object.keys(data.prices).length : 0;
      
      setResult({
        success: true,
        staleETFs,
        pricesUpdated,
        prices: data?.prices || {}
      });
      
      toast.success(`Successfully updated ${pricesUpdated} of ${staleTickers.length} stale prices!`);
      
    } catch (error) {
      console.error('Stale price update failed:', error);
      toast.error(`Update failed: ${error.message}`);
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Stale Price Updater
        </CardTitle>
        <CardDescription>
          Updates ETF prices that are more than 24 hours old. This targets NEO Exchange (.NE) and other stale prices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This will find all ETFs with prices older than 24 hours and attempt to fetch fresh prices from EODHD, Yahoo Finance, and Stooq.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={updateStalePrices}
          disabled={isUpdating}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? 'Updating Stale Prices...' : 'Update Stale Prices'}
        </Button>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertCircle className={`h-4 w-4 ${result.success ? 'text-green-600' : 'text-red-600'}`} />
            <AlertDescription>
              {result.success ? (
                <div className="space-y-2">
                  <div className="font-medium">Update Results:</div>
                  {result.message && <div>{result.message}</div>}
                  {result.staleETFs && (
                    <div>
                      <div>Found {result.staleETFs.length} stale ETFs</div>
                      <div>Successfully updated {result.pricesUpdated} prices</div>
                      {result.staleETFs.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium">View Stale ETFs</summary>
                          <div className="mt-2 text-sm">
                            {result.staleETFs.map((etf: any) => (
                              <div key={etf.ticker} className="flex justify-between">
                                <span>{etf.ticker} ({etf.exchange})</span>
                                <span className="text-gray-500">
                                  {etf.price_updated_at ? new Date(etf.price_updated_at).toLocaleDateString() : 'Never'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="font-medium">Update Failed:</div>
                  <div>{result.error}</div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};