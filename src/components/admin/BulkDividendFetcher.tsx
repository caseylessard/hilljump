import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Check, Download, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const BulkDividendFetcher = () => {
  const [tickers, setTickers] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    processed?: number;
    successful?: number;
    failed?: number;
  } | null>(null);

  const handleFetch = async () => {
    const tickerList = tickers
      .split(/[\n,\s]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    if (tickerList.length === 0) {
      setResult({
        success: false,
        message: 'Please provide at least one ticker symbol.'
      });
      return;
    }

    setLoading(true);
    setResult(null);
    toast.info(`Fetching dividends for ${tickerList.length} tickers...`);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult({
          success: false,
          message: 'You must be logged in to fetch dividend data.'
        });
        return;
      }

      // Call the dividend updater for specific tickers
      const { data, error } = await supabase.functions.invoke('dividend-updater', {
        body: { 
          tickers: tickerList,
          manual: true 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      setResult({
        success: true,
        message: data.message || `Processed ${tickerList.length} tickers`,
        processed: tickerList.length,
        successful: data.successful || 0,
        failed: data.failed || 0
      });
      
      toast.success('Dividend fetch completed!');
      
    } catch (error: any) {
      console.error('Bulk dividend fetch error:', error);
      setResult({
        success: false,
        message: error.message || 'Failed to fetch dividend data'
      });
      toast.error('Failed to fetch dividends');
    } finally {
      setLoading(false);
    }
  };

  const loadMissingDividendTickers = () => {
    // Pre-populate with the tickers that have no dividend data
    const missingTickers = `AEME
BCEE
CCOE
CNQE
ENBE
HHIC
HHIH
QQCL
RYHE
SHPE
SUHE
TDHE
TEHE
DIPS
PLTY
NVDY
HTA.TO
MARO
IWMW
IWMY
MSHE.TO
NVDW
QRMI
TDHE.TO
GOGY.TO
MSII
RYLG
ESPX.TO
QYLD
JPMO
ULTY`;
    setTickers(missingTickers);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Bulk Dividend Fetcher
        </CardTitle>
        <CardDescription>
          Fetch dividend data for specific ETF tickers using external APIs (Yahoo Finance, Alpha Vantage)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="ticker-list" className="text-sm font-medium mb-2 block">
            ETF Tickers
          </label>
          <Textarea
            id="ticker-list"
            placeholder="Enter ticker symbols (one per line or comma separated)&#10;Example:&#10;MSTY&#10;TSLY&#10;NVDY"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
        </div>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {result.success ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
              {result.message}
              {result.processed !== undefined && (
                <div className="mt-2 text-sm">
                  <div>Processed: {result.processed} tickers</div>
                  {result.successful !== undefined && <div>Successful: {result.successful}</div>}
                  {result.failed !== undefined && <div>Failed: {result.failed}</div>}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleFetch}
            disabled={loading || !tickers.trim()}
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {loading ? 'Fetching...' : 'Fetch Dividends'}
          </Button>
          
          <Button
            variant="outline"
            onClick={loadMissingDividendTickers}
            disabled={loading}
          >
            Load Missing Tickers
          </Button>
          
          {tickers && (
            <Button
              variant="outline"
              onClick={() => {
                setTickers('');
                setResult(null);
              }}
              disabled={loading}
            >
              Clear
            </Button>
          )}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> This will attempt to fetch dividend data from Yahoo Finance and Alpha Vantage APIs. 
            Some tickers may fail due to API limitations or data availability.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};