import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function HistoricalPriceTest() {
  const [loading, setLoading] = useState(false);
  
  const fetchHistoricalPrices = async () => {
    setLoading(true);
    try {
      console.log('📊 Calling fetch-historical-prices...');
      const { data, error } = await supabase.functions.invoke('fetch-historical-prices', {
        body: { 
          tickers: ['XYLD', 'QYLD', 'TSLY', 'MSTY', 'ULTY'], 
          days: 365 
        }
      });
      
      if (error) {
        console.error('Error:', error);
        toast.error(`Error: ${error.message}`);
      } else {
        console.log('Success:', data);
        toast.success(`Fetched historical prices: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error('Catch error:', err);
      toast.error('Failed to fetch historical prices');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Historical Price Test</h3>
      <Button 
        onClick={fetchHistoricalPrices} 
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Fetching...' : 'Fetch Historical Prices (Test ETFs)'}
      </Button>
    </div>
  );
}