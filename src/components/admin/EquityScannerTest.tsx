import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function EquityScannerTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runScanner = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('daily-equity-scanner', {
        body: {
          universe: ["PLTY", "MSTY", "TSLY", "NVDY", "RYLD", "QYLD", "JEPI", "JEPQ"],
          config: {
            min_price: 1.0,
            max_price: 50.0,
            min_gap_pct: 1.0, // Lower threshold for testing
            weights: {
              gap: 0.5,
              rel_vol: 0.22,
              float: 0.18,
              news: 0.1
            }
          }
        }
      });

      if (error) throw error;
      
      setResults(data);
      toast({
        title: "Scanner Complete",
        description: `Found ${data.all_picks?.length || 0} equity alerts`
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
            📈 Daily Equity Scanner Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runScanner} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? "🔍 Scanning..." : "🚀 Run Equity Scanner"}
          </Button>
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
                    <strong>Top Pick:</strong> {results.top_pick?.ticker}
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
                    <h4 className="font-semibold mb-2">🥇 Top Pick: {results.top_pick.ticker}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <div>Price: ${results.top_pick.price?.toFixed(2) || "—"}</div>
                      <div>Gap: {results.top_pick.premarket_change_pct?.toFixed(1) || "—"}%</div>
                      <div>Score: {results.top_pick.mover_score?.toFixed(3) || "—"}</div>
                      <div>Float: {results.top_pick.float_shares ? `${(results.top_pick.float_shares/1e6).toFixed(1)}M` : "—"}</div>
                      <div>RelVol: {results.top_pick.rel_vol?.toFixed(2) || "—"}×</div>
                      <div>Exchange: {results.top_pick.exchange || "—"}</div>
                    </div>
                  </div>
                )}

                {results.all_picks && results.all_picks.length > 1 && (
                  <div>
                    <h4 className="font-semibold mb-2">All Picks:</h4>
                    <div className="space-y-2">
                      {results.all_picks.map((pick: any, idx: number) => (
                        <div key={pick.ticker} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{idx + 1}</Badge>
                            <span className="font-medium">{pick.ticker}</span>
                            <span>${pick.price?.toFixed(2) || "—"}</span>
                          </div>
                          <div className="text-right">
                            <div>Gap: {pick.premarket_change_pct?.toFixed(1) || "—"}%</div>
                            <div className="text-xs opacity-70">Score: {pick.mover_score?.toFixed(3) || "—"}</div>
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