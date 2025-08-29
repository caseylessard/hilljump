import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function DripCalculationTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  const testDripCalculations = async () => {
    setLoading(true);
    setResults(null);
    
    try {
      console.log('🧮 Calling calculate-drip for NVHE and YBTC...');
      const { data, error } = await supabase.functions.invoke('calculate-drip', {
        body: { 
          tickers: ['NVHE', 'YBTC'],
          taxPrefs: {
            country: 'US',
            withholdingTax: true // US client with tax
          }
        }
      });
      
      if (error) {
        console.error('Error:', error);
        toast.error(`Error: ${error.message}`);
      } else {
        console.log('DRIP Results:', data);
        setResults(data);
        toast.success('DRIP calculations completed');
      }
    } catch (err) {
      console.error('Catch error:', err);
      toast.error('Failed to calculate DRIP');
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatDollar = (value: number | undefined | null) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>DRIP Calculation Test - US Client with Tax</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testDripCalculations} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Calculating...' : 'Calculate 52-week DRIP for NVHE & YBTC'}
          </Button>

          {results && (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                Processed: {results.processed || 0} tickers | 
                Errors: {results.errors?.length || 0}
              </div>

              {['NVHE', 'YBTC'].map(ticker => {
                const tickerData = results.dripData?.[ticker];
                if (!tickerData) {
                  return (
                    <Card key={ticker}>
                      <CardHeader>
                        <CardTitle className="text-lg">{ticker}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-red-500">No DRIP data available</div>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <Card key={ticker}>
                    <CardHeader>
                      <CardTitle className="text-lg">{ticker}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">52-Week DRIP Performance</h4>
                          <div className="space-y-1 text-sm">
                            <div>Percentage: {formatPercent(tickerData.drip52wPercent)}</div>
                            <div>Dollar Value: {formatDollar(tickerData.drip52wDollar)}</div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Other Periods</h4>
                          <div className="space-y-1 text-sm">
                            <div>4w: {formatPercent(tickerData.drip4wPercent)}</div>
                            <div>13w: {formatPercent(tickerData.drip13wPercent)}</div>
                            <div>26w: {formatPercent(tickerData.drip26wPercent)}</div>
                          </div>
                        </div>
                      </div>

                      {tickerData.audit && tickerData.audit.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Recent Reinvestments (52w period)</h4>
                          <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                            {tickerData.audit.slice(-10).map((event: any, i: number) => (
                              <div key={i} className="bg-muted p-2 rounded">
                                {event.date}: {event.type} - {event.description}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {results.errors && results.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-500">Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {results.errors.map((error: any, i: number) => (
                        <div key={i} className="text-sm text-red-600">
                          {error.ticker}: {error.error}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}