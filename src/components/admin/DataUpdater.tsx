import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Clock, CheckCircle, XCircle } from "lucide-react";

export function DataUpdater() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<any>(null);

  const runManualUpdate = async () => {
    setIsUpdating(true);
    toast.info("Starting data updates...");

    try {
      const { data, error } = await supabase.functions.invoke('run-daily-updates', {
        body: { manual: true }
      });

      if (error) throw error;

      setLastUpdate(data);
      
      if (data.totalErrors > 0) {
        toast.warning(`Updates completed with ${data.totalErrors} errors. Check console for details.`);
      } else {
        toast.success("All data updates completed successfully!");
      }

    } catch (error) {
      console.error('Update failed:', error);
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Daily Data Updates
        </CardTitle>
        <CardDescription>
          Manually trigger the daily data update sequence or monitor scheduled updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={runManualUpdate} 
            disabled={isUpdating}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isUpdating ? "Updating..." : "Run Updates Now"}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Scheduled daily at 6:00 AM UTC
          </div>
        </div>

        {lastUpdate && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium">Last Update Results</h4>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {lastUpdate.results.etfUpdate ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                  <XCircle className="h-4 w-4 text-red-500" />
                }
                Yahoo Finance ETF Data
              </div>
              
              <div className="flex items-center gap-2">
                {lastUpdate.results.dividendUpdate ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                  <XCircle className="h-4 w-4 text-red-500" />
                }
                Dividend Updates
              </div>
              
              <div className="flex items-center gap-2">
                {lastUpdate.results.dripUpdate ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                  <XCircle className="h-4 w-4 text-red-500" />
                }
                DRIP Calculations
              </div>
              
              <div className="flex items-center gap-2">
                {lastUpdate.results.historicalUpdate ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                  <XCircle className="h-4 w-4 text-red-500" />
                }
                Historical Prices
              </div>
            </div>

            {lastUpdate.totalErrors > 0 && (
              <div className="space-y-1">
                <Badge variant="destructive" className="text-xs">
                  {lastUpdate.totalErrors} Errors
                </Badge>
                <div className="text-xs text-red-600 space-y-1">
                  {lastUpdate.results.errors.map((error: string, i: number) => (
                    <div key={i}>• {error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Update Sequence:</strong></p>
          <p>1. ETF metadata & performance (Yahoo Finance)</p>
          <p>2. Dividend distributions (Yahoo Finance)</p>
          <p>3. DRIP performance calculations</p>
          <p>4. Historical price updates (EODHD)</p>
        </div>
      </CardContent>
    </Card>
  );
}