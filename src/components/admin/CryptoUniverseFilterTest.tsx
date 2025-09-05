import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function CryptoUniverseFilterTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runFilter = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('filter-crypto-universe', {
        body: {
          config: {
            top_n: 50,
            min_price: 0.01,
            max_price: 10000, // Lower max for testing
            min_vol_usd: 2_000_000, // Lower for testing
            weights: {
              change: 0.55,
              atr: 0.30,
              volume: 0.15
            }
          }
        }
      });

      if (error) throw error;
      
      setResults(data);
      toast({
        title: "Crypto Filter Complete",
        description: `Filtered ${data.universe?.length || 0} coins`
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
        .from('crypto_universe')
        .select('*')
        .order('rank_order', { ascending: true })
        .limit(25);
        
      if (error) throw error;
      
      setResults({
        success: true,
        message: `Found ${data.length} stored coins`,
        universe: data.map(c => c.symbol),
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
            🚀 Crypto Universe Filter Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={runFilter} 
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? "🔄 Filtering..." : "⚡ Run Crypto Filter"}
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
            <div>• Filters ~70 major crypto symbols</div>
            <div>• Scores by 24h change (55%) + ATR volatility (30%) + volume (15%)</div>
            <div>• Min $2M daily volume, $0.01-$10K price range</div>
            <div>• Returns top momentum coins</div>
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
                    <h4 className="font-semibold mb-2">🎯 Filtered Universe ({results.universe.length} coins):</h4>
                    <div className="bg-muted/50 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
                      {results.universe.join(', ')}
                    </div>
                  </div>
                )}

                {results.details && results.details.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Top 10 Momentum Coins:</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {results.details.slice(0, 10).map((coin: any, idx: number) => (
                        <div key={coin.symbol} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{idx + 1}</Badge>
                            <span className="font-medium">{coin.symbol}</span>
                          </div>
                          <div className="text-right">
                            <div className="flex gap-3 text-xs">
                              <span>${coin.price?.toFixed(4) || "—"}</span>
                              <span className={`${(coin.change_24h_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {coin.change_24h_pct?.toFixed(1) || "—"}%
                              </span>
                            </div>
                            <div className="text-xs opacity-70">
                              ATR: {coin.atr_pct?.toFixed(2) || "—"}% • Score: {coin.momentum_score?.toFixed(3) || "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.stats && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <strong>Config:</strong> Top {results.stats.config?.top_n}, 
                    Change weight {results.stats.config?.weights?.change || '?'}×, 
                    ATR weight {results.stats.config?.weights?.atr || '?'}×, 
                    Volume weight {results.stats.config?.weights?.volume || '?'}×
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