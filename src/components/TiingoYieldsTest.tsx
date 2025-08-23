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
      
      const analysis = {
        success: true,
        timestamp: new Date().toISOString(),
        source: 'tiingo-yields',
        result: data
      };
      
      setResult(JSON.stringify(analysis, null, 2));
      
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
        {loading ? 'Testing...' : 'Test Tiingo Yields Function'}
      </Button>
      <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
        {result || 'Click the button to test the Tiingo yields function (processes all active ETFs, runs once per day)'}
      </pre>
    </Card>
  );
};