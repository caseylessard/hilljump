import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function PriceSystemTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  const testPriceSystem = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing price system...');
      
      // Test with a few US and Canadian tickers
      const testTickers = ['XYLD', 'QYLD', 'ZDV.TO', 'VDY.TO', 'TSLY'];
      
      // First check database prices
      const { data: dbPrices, error: dbError } = await supabase
        .from('etfs')
        .select('ticker, current_price, price_updated_at')
        .in('ticker', testTickers);
      
      if (dbError) throw dbError;
      
      // Then test live price fetching
      const { data: liveData, error: liveError } = await supabase.functions.invoke('quotes', {
        body: { tickers: testTickers }
      });
      
      if (liveError) throw liveError;
      
      // Test price cache sync
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-price-cache', {
        body: { force_historical: false }
      });
      
      if (syncError) throw syncError;
      
      const result = {
        database_prices: dbPrices || [],
        live_prices: liveData?.prices || {},
        cache_sync: syncData || {},
        test_timestamp: new Date().toISOString()
      };
      
      setResults(result);
      toast.success('Price system test completed successfully!');
      
    } catch (error) {
      console.error('Price system test failed:', error);
      toast.error(`Test failed: ${error.message}`);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Price System Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testPriceSystem} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Testing Price System...' : 'Test Price System'}
        </Button>
        
        {results && (
          <div className="space-y-2">
            <h4 className="font-semibold">Test Results:</h4>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="text-sm text-gray-600">
          <h4 className="font-semibold mb-2">What this tests:</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Database price retrieval (cached prices)</li>
            <li>Live price fetching via quotes function</li>
            <li>Price cache synchronization</li>
            <li>Error handling and fallbacks</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}