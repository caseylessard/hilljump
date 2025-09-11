import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRefreshDRIP, useRefreshScores } from '@/hooks/useCachedETFData';
import { useQueryClient } from '@tanstack/react-query';

interface RefreshDataButtonProps {
  type: 'drip' | 'scores' | 'both';
  tickers?: string[];
  taxPreferences?: any;
  weights?: any;
  country?: string;
  className?: string;
}

export const RefreshDataButton: React.FC<RefreshDataButtonProps> = ({
  type,
  tickers = [],
  taxPreferences,
  weights,
  country = 'CA',
  className
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  
  const refreshDRIP = useRefreshDRIP();
  const refreshScores = useRefreshScores();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      if (type === 'drip' || type === 'both') {
        toast.info('Refreshing DRIP data...');
        await refreshDRIP.mutateAsync({ tickers, taxPreferences });
        
        // Invalidate DRIP cache
        queryClient.invalidateQueries({ queryKey: ['cached-drip'] });
        toast.success('DRIP data refreshed!');
      }

      if (type === 'scores' || type === 'both') {
        toast.info('Refreshing scores...');
        await refreshScores.mutateAsync({ tickers, weights, country });
        
        // Invalidate scores cache
        queryClient.invalidateQueries({ queryKey: ['stored-scores'] });
        toast.success('Scores refreshed!');
      }

      if (type === 'both') {
        toast.success('All data refreshed successfully!');
      }

    } catch (error) {
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
      {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
    </Button>
  );
};