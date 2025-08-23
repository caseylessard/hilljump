import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const YahooFinanceTest = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testYahooAPI = async () => {
    setLoading(true);
    setResult('Loading...');
    
    try {
      const ticker = 'PLTY';
      
      console.log('📊 Fetching Yahoo Finance data for', ticker, 'via edge function');
      
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('yahoo-finance-test', {
        body: { ticker }
      });
      
      if (error) {
        console.error('❌ Edge function error:', error);
        setResult(`❌ Edge function error: ${error.message}`);
        return;
      }
      
      if (data.success) {
        console.log('✅ Yahoo Finance response received via edge function:');
        console.log(JSON.stringify(data, null, 2));
        setResult(JSON.stringify(data, null, 2));
      } else {
        setResult(`❌ Yahoo Finance API error: ${data.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 m-4">
      <h2 className="text-xl font-bold mb-4">Yahoo Finance API Test for PLTY</h2>
      <Button onClick={testYahooAPI} disabled={loading} className="mb-4">
        {loading ? 'Testing...' : 'Test Yahoo Finance API for PLTY'}
      </Button>
      <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
        {result || 'Click the button to test the Yahoo Finance API'}
      </pre>
    </Card>
  );
};