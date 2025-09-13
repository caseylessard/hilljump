import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRefreshDRIP } from '@/hooks/useCachedETFData';
import { useQueryClient } from '@tanstack/react-query';

interface RefreshDataButtonProps {
  type: 'drip';
  tickers?: string[];
  taxPreferences?: any;
  className?: string;
}

export const RefreshDataButton: React.FC<RefreshDataButtonProps> = ({
  type,
  tickers = [],
  taxPreferences,
  className
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  
  const refreshDRIP = useRefreshDRIP();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      toast.info('Refreshing DRIP data...');
      await refreshDRIP.mutateAsync({ tickers, taxPreferences });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['cached-drip'] });
      queryClient.invalidateQueries({ queryKey: ['drip-cache'] });
      toast.success('DRIP data refreshed successfully');
      
    } catch (error: any) {
      console.error('Refresh failed:', error);
      toast.error(`Refresh failed: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      onClick={handleRefresh}
      disabled={isRefreshing}
      variant="outline"
      size="sm"
      className={className}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : 'Refresh DRIP'}
    </Button>
  );
};