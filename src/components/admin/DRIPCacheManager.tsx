import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const DRIPCacheManager = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleForceDRIPRecalc = async () => {
    setIsRefreshing(true);
    
    try {
      toast.info("Clearing DRIP cache and forcing recalculation...");
      
      const { data, error } = await supabase.functions.invoke('force-drip-recalc');
      
      if (error) {
        console.error('DRIP recalculation error:', error);
        toast.error(`Failed to recalculate DRIP: ${error.message}`);
      } else {
        console.log('DRIP recalculation result:', data);
        toast.success("DRIP cache cleared and recalculation triggered successfully!");
      }
    } catch (error) {
      console.error('DRIP recalculation failed:', error);
      toast.error(`DRIP recalculation failed: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Use this to force a complete DRIP cache refresh after importing new dividend or price data.
          This will clear existing cache and recalculate all DRIP values.
        </AlertDescription>
      </Alert>
      
      <Button
        onClick={handleForceDRIPRecalc}
        disabled={isRefreshing}
        variant="destructive"
        className="w-full"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? "Recalculating DRIP..." : "Force DRIP Recalculation"}
      </Button>
    </div>
  );
};