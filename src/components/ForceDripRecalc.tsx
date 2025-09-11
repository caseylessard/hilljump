import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lyjfwnlindbsbbwjzefh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8'
);

export const ForceDripRecalc = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRecalc = async () => {
    setIsLoading(true);
    toast.info('🔄 Clearing DRIP cache and triggering fresh calculations...');
    
    try {
      const { data, error } = await supabase.functions.invoke('force-drip-recalc');
      
      if (error) {
        console.error('Force DRIP recalc error:', error);
        toast.error('❌ Failed to trigger DRIP recalculation');
      } else {
        console.log('Force DRIP recalc result:', data);
        toast.success('✅ DRIP cache cleared and recalculation triggered!');
        
        // Refresh the page after a short delay to show new data
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error('Force DRIP recalc error:', error);
      toast.error('❌ Failed to trigger DRIP recalculation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleRecalc}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {isLoading ? '🔄 Recalculating...' : '🔄 Fix DRIP Cache'}
    </Button>
  );
};