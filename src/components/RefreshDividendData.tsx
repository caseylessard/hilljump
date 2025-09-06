import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { resetCache } from '@/lib/cacheUtils';

export const RefreshDividendData = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const { toast } = useToast();

  const refreshDividendData = async () => {
    setRefreshing(true);
    setResult(null);

    try {
      console.log('🔄 Starting dividend data refresh...');
      
      // 1. Trigger dividend updater
      const { data: updateResult, error: updateError } = await supabase.functions.invoke('dividend-updater', {
        body: { manual: true, source: 'manual_refresh' }
      });

      if (updateError) {
        throw new Error(`Dividend update failed: ${updateError.message}`);
      }

      console.log('✅ Dividend update completed:', updateResult);

      // 2. Clear all caches
      resetCache();
      console.log('🧹 Cache cleared');

      // 3. Verify MSTY data
      const { data: mstyCheck } = await supabase
        .from('dividends')
        .select('ticker, amount, ex_date')
        .eq('ticker', 'MSTY')
        .gte('ex_date', '2025-08-01')
        .order('ex_date', { ascending: false });

      setResult({
        success: true,
        message: `Data refresh completed! Updated ${updateResult?.updated_etfs || 0} ETFs, found ${updateResult?.inserted_events || 0} new dividends.`,
        details: {
          updateResult,
          mstyRecords: mstyCheck?.length || 0,
          latestMSTY: mstyCheck?.[0]?.ex_date
        }
      });

      toast({
        title: "Data Refreshed",
        description: "Dividend data has been updated and cache cleared",
      });

    } catch (error: any) {
      console.error('❌ Refresh failed:', error);
      setResult({
        success: false,
        message: error.message || 'Failed to refresh dividend data'
      });

      toast({
        title: "Refresh Failed",
        description: error.message || 'Failed to refresh dividend data',
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Dividend Data
        </CardTitle>
        <CardDescription>
          Manually trigger dividend data update and clear cache to show latest distributions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={refreshDividendData}
          disabled={refreshing}
          className="w-full flex items-center gap-2"
          size="lg"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing Data...' : 'Refresh Dividend Data Now'}
        </Button>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
              {result.message}
              {result.details && result.success && (
                <div className="mt-2 text-sm space-y-1">
                  <div>MSTY Records Found: {result.details.mstyRecords}</div>
                  {result.details.latestMSTY && (
                    <div>Latest MSTY Ex-Date: {result.details.latestMSTY}</div>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This will fetch the latest dividend data from Yahoo Finance and Alpha Vantage, 
            then clear the application cache to ensure you see updated information immediately.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};