import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateResult {
  success: boolean;
  totalProcessed: number;
  totalInserted: number;
  totalErrors: number;
  successfulMappings: number;
  message: string;
  error?: string;
}

export const EnhancedDividendUpdater: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);

  const runEnhancedUpdate = async () => {
    setIsUpdating(true);
    setResult(null);
    
    try {
      toast.info('Starting enhanced dividend update...');
      
      const { data, error } = await supabase.functions.invoke('enhanced-dividend-updater', {});
      
      if (error) {
        throw error;
      }
      
      setResult(data);
      
      if (data.success) {
        toast.success(`Enhanced update completed! ${data.successfulMappings} Purpose ETFs mapped, ${data.totalInserted} dividends inserted`);
      } else {
        toast.error(`Update failed: ${data.error || 'Unknown error'}`);
      }
      
    } catch (error: any) {
      console.error('Enhanced dividend update failed:', error);
      setResult({
        success: false,
        totalProcessed: 0,
        totalInserted: 0,
        totalErrors: 1,
        successfulMappings: 0,
        message: `Update failed: ${error.message || 'Unknown error'}`,
        error: error.message
      });
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Enhanced Dividend Updater
        </CardTitle>
        <CardDescription>
          Automatically maps Canadian Purpose ETFs (.NE) to their underlying US stocks for dividend data.
          Fixes missing dividends for YNVD.NE, YTSL.NE, APLY.NE and other Purpose funds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">What this does:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Maps YNVD.NE → NVDA (NVIDIA) dividends</li>
            <li>• Maps YTSL.NE → TSLA (Tesla) dividends</li>
            <li>• Maps APLY.NE → AAPL (Apple) dividends</li>
            <li>• Processes all other Purpose ETFs with underlying mappings</li>
            <li>• Also updates regular ETF dividends as backup</li>
          </ul>
        </div>

        <Button 
          onClick={runEnhancedUpdate} 
          disabled={isUpdating}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? 'Running Enhanced Update...' : 'Run Enhanced Dividend Update'}
        </Button>

        {result && (
          <Alert>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">
                  {result.success ? 'Update Successful!' : 'Update Failed'}
                </div>
                <div className="text-sm space-y-1">
                  <div>📊 Total ETFs Processed: {result.totalProcessed}</div>
                  <div>🎯 Purpose ETFs Mapped: {result.successfulMappings}</div>
                  <div>📈 Dividends Inserted: {result.totalInserted}</div>
                  {result.totalErrors > 0 && (
                    <div>❌ Errors: {result.totalErrors}</div>
                  )}
                </div>
                {result.message && (
                  <div className="text-sm mt-2 p-2 bg-muted rounded">
                    {result.message}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Before Running:</div>
              <div className="text-sm">
                This will fetch dividend data from Yahoo Finance and map Canadian Purpose ETFs to their underlying US stocks.
                The process may take 1-2 minutes to complete.
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};