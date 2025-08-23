import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const FinnhubYieldsTest = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testYahooAPI = async () => {
    setLoading(true);
    setResult('Loading...');
    
    try {
      const ticker = 'PLTY';
      
      console.log('📊 Testing Finnhub yields function');
      
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Call the new finnhub-yields function
      const { data, error } = await supabase.functions.invoke('finnhub-yields');
      
      if (error) {
        console.error('❌ finnhub-yields function error:', error);
        setResult(`❌ Finnhub yields function error: ${error.message}`);
        return;
      }
      
      console.log('✅ Finnhub yields response:');
      console.log(JSON.stringify(data, null, 2));
      
      const analysis = {
        ticker: ticker,
        success: true,
        timestamp: new Date().toISOString(),
        source: 'finnhub-yields',
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
      <h2 className="text-xl font-bold mb-4">Finnhub Yields Function Test</h2>
      <Button onClick={testYahooAPI} disabled={loading} className="mb-4">
        {loading ? 'Testing...' : 'Test Finnhub Yields Function'}
      </Button>
      <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
        {result || 'Click the button to test the Finnhub yields function (processes all active ETFs, runs once per day)'}
      </pre>
    </Card>
  );
};