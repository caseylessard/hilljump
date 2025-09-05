import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function CryptoScannerTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runScanner = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('daily-crypto-scanner', {
        body: {
          use_filtered_universe: true, // Use DB filtered universe
          config: {
            min_price: 0.05,
            max_price: 10000,
            min_change_24h_pct: 0.5, // Lower threshold for testing
            weights: {
              change: 0.6,
              rel_vol: 0.3,
              news: 0.1
            },
            target: {
              min: 3.0,
              max: 18.0,
              atr_w: 0.65,
              change_w: 0.35
            }
          }
        }
      });

      if (error) throw error;
      
      setResults(data);
      toast({
        title: "Crypto Scanner Complete",
        description: `Found ${data.all_picks?.length || 0} crypto alerts`
      });
      
    } catch (error) {
      console.error('Scanner error:', error);
      toast({
        title: "Scanner Error", 
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🚀 Daily Crypto Scanner Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runScanner} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? "🔍 Scanning..." : "⚡ Run Crypto Scanner"}
          </Button>
          
          <div className="mt-3 text-xs text-muted-foreground">
            Uses filtered crypto universe (high momentum coins with volatility)
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results.success ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Status:</strong> <Badge variant="default">Success</Badge>
                  </div>
                  <div>
                    <strong>Top Pick:</strong> {results.top_pick?.symbol}
                  </div>
                  <div>
                    <strong>Total Alerts:</strong> {results.all_picks?.length || 0}
                  </div>
                  <div>
                    <strong>Timestamp:</strong> {new Date(results.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {results.top_pick && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-semibold mb-2">🥇 Top Pick: {results.top_pick.symbol}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <div>Price: ${results.top_pick.price?.toFixed(4) || "—"}</div>
                      <div className={`${(results.top_pick.change_24h_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        24h: {results.top_pick.change_24h_pct?.toFixed(1) || "—"}%
                      </div>
                      <div>Score: {results.top_pick.likelihood_of_win?.toFixed(3) || "—"}</div>
                      <div>Target: {results.top_pick.target_growth_pct?.toFixed(1) || "—"}%</div>
                      <div>RelVol: {results.top_pick.rel_vol?.toFixed(2) || "—"}×</div>
                      <div>ATR: {results.top_pick.atr_pct?.toFixed(2) || "—"}%</div>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Trading Plan:</span> Entry ${results.top_pick.entry_price?.toFixed(4)} • 
                      SL ${results.top_pick.stop_price?.toFixed(4)} • 
                      TP1 ${results.top_pick.tp1_price?.toFixed(4)} • 
                      TP2 ${results.top_pick.tp2_price?.toFixed(4)}
                    </div>
                  </div>
                )}

                {results.all_picks && results.all_picks.length > 1 && (
                  <div>
                    <h4 className="font-semibold mb-2">All Crypto Alerts:</h4>
                    <div className="space-y-2">
                      {results.all_picks.map((pick: any, idx: number) => (
                        <div key={pick.symbol} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{idx + 1}</Badge>
                            <span className="font-medium">{pick.symbol}</span>
                            <span>${pick.price?.toFixed(4) || "—"}</span>
                          </div>
                          <div className="text-right">
                            <div className={`${(pick.change_24h_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              24h: {pick.change_24h_pct?.toFixed(1) || "—"}%
                            </div>
                            <div className="text-xs opacity-70">
                              Target: {pick.target_growth_pct?.toFixed(1) || "—"}% • 
                              Score: {pick.likelihood_of_win?.toFixed(3) || "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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