import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { warmGlobalCache, clearAllCache, clearHomepageCache } from "@/lib/globalCache";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface RefreshButtonProps {
  onRefreshStart?: () => void;
  onRefreshComplete?: () => void;
}

export const RefreshButton = ({ onRefreshStart, onRefreshComplete }: RefreshButtonProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    onRefreshStart?.();
    
    try {
      toast.info("Refreshing data...");
      
      // Clear all caches and force refresh
      queryClient.clear();
      clearAllCache();
      clearHomepageCache();
      await warmGlobalCache(true);
      
      toast.success("Data refreshed successfully!");
    } catch (error) {
      console.error("Refresh failed:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
      onRefreshComplete?.();
    }
  };

  return (
    <Button 
      onClick={handleRefresh}
      disabled={isRefreshing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? "Refreshing..." : "Refresh Data"}
    </Button>
  );
};