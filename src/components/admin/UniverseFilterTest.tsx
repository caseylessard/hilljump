import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function UniverseFilterTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runFilter = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('filter-equity-universe', {
        body: {
          config: {
            require_float: true,
            min_float: 1_000_000,
            max_float: 15_000_000, // Slightly higher for testing
            max_price: 3.00, // Higher for testing
            min_avg_dollar_vol: 500_000, // Lower for testing
            max_out: 50
          }
        }
      });

      if (error) throw error;
      
      setResults(data);
      toast({
        title: "Universe Filter Complete",
        description: `Filtered ${data.universe?.length || 0} tickers`
      });
      
    } catch (error) {
      console.error('Filter error:', error);
      toast({
        title: "Filter Error", 
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const viewStoredUniverse = async () => {
    try {
      const { data, error } = await supabase
        .from('equity_universe')
        .select('*')
        .order('rank_order', { ascending: true })
        .limit(20);
        
      if (error) throw error;
      
      setResults({
        success: true,
        message: `Found ${data.length} stored tickers`,
        universe: data.map(t => t.ticker),
        details: data,
        stats: { stored: data.length }
      });
      
    } catch (error) {
      console.error('Database error:', error);
      toast({
        title: "Database Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Equity Universe Filter Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={runFilter} 
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? "🔄 Filtering..." : "🚀 Run Universe Filter"}
            </Button>
            
            <Button 
              onClick={viewStoredUniverse} 
              variant="outline"
              className="w-full"
            >
              📊 View Stored Universe
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <div>• Filters ~90 seed tickers for small-caps</div>
            <div>• Price under $3, Float 1M-15M shares</div>
            <div>• Min $500K avg daily volume</div>
            <div>• Excludes ETFs, non-US exchanges</div>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Filter Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results.success ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Status:</strong> <Badge variant="default">Success</Badge>
                  </div>
                  <div>
                    <strong>Universe Size:</strong> {results.universe?.length || 0}
                  </div>
                  <div>
                    <strong>Processed:</strong> {results.stats?.processed || 'N/A'}
                  </div>
                  <div>
                    <strong>Errors:</strong> {results.stats?.errors || 0}
                  </div>
                </div>

                {results.universe && results.universe.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">🎯 Filtered Universe ({results.universe.length} tickers):</h4>
                    <div className="bg-muted/50 p-3 rounded text-xs font-mono">
                      {results.universe.join(', ')}
                    </div>
                  </div>
                )}

                {results.details && results.details.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Top 10 Details:</h4>
                    <div className="space-y-2">
                      {results.details.slice(0, 10).map((ticker: any, idx: number) => (
                        <div key={ticker.ticker} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{idx + 1}</Badge>
                            <span className="font-medium">{ticker.ticker}</span>
                            <span className="text-xs text-muted-foreground">{ticker.exchange}</span>
                          </div>
                          <div className="text-right">
                            <div>${ticker.price?.toFixed(2) || "—"}</div>
                            <div className="text-xs opacity-70">
                              {ticker.float_shares ? `${(ticker.float_shares/1e6).toFixed(1)}M float` : 'No float'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.stats && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <strong>Filter Config:</strong> Max price ${results.stats.config?.max_price}, 
                    Float {results.stats.config?.min_float ? (results.stats.config.min_float/1e6).toFixed(1) : '?'}M-{results.stats.config?.max_float ? (results.stats.config.max_float/1e6).toFixed(1) : '?'}M, 
                    Min vol ${results.stats.config?.min_avg_dollar_vol ? (results.stats.config.min_avg_dollar_vol/1e3).toFixed(0) : '?'}K
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600">
                <strong>Error:</strong> {results.error || results.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}