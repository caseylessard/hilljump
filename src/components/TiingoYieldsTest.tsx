import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const TiingoYieldsTest = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testTiingoAPI = async () => {
    setLoading(true);
    setResult('Loading...');
    
    try {
      console.log('📊 Testing Tiingo yields function');
      
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Call the new tiingo-yields function
      const { data, error } = await supabase.functions.invoke('tiingo-yields');
      
      if (error) {
        console.error('❌ tiingo-yields function error:', error);
        setResult(`❌ Tiingo yields function error: ${error.message}`);
        return;
      }
      
      console.log('✅ Tiingo yields response:');
      console.log(JSON.stringify(data, null, 2));
      
      // Format the result for better display
      let displayResult;
      if (data.summary) {
        // This is the full yield update result
        displayResult = {
          success: data.success,
          message: data.message,
          timestamp: data.timestamp,
          totalETFs: data.summary.totalETFs,
          successfulUpdates: data.summary.successCount,
          errors: data.summary.errorCount,
          errorSample: data.summary.errors?.slice(0, 5) || []
        };
      } else {
        // This was just the basic test
        displayResult = data;
      }
      
      setResult(JSON.stringify(displayResult, null, 2));
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 m-4">
      <h2 className="text-xl font-bold mb-4">Tiingo Yields Function Test</h2>
      <Button onClick={testTiingoAPI} disabled={loading} className="mb-4">
        {loading ? 'Updating Yields...' : 'Update ETF Yields from Tiingo'}
      </Button>
      <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
        {result || 'Click the button to fetch and update ETF yield data from Tiingo API (processes all active ETFs)'}
      </pre>
    </Card>
  );
};