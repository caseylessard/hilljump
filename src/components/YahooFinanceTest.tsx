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
      
      console.log('📊 Testing with existing yfinance-yields function for', ticker);
      
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Try the existing yfinance-yields function first
      const { data, error } = await supabase.functions.invoke('yfinance-yields', {
        body: { tickers: [ticker] }
      });
      
      if (error) {
        console.error('❌ yfinance-yields function error:', error);
        
        // Fallback to the new yahoo-finance-test function
        console.log('📊 Trying yahoo-finance-test function...');
        
        const { data: testData, error: testError } = await supabase.functions.invoke('yahoo-finance-test', {
          body: { ticker }
        });
        
        if (testError) {
          console.error('❌ yahoo-finance-test function error:', testError);
          setResult(`❌ Both functions failed:\n1. yfinance-yields: ${error.message}\n2. yahoo-finance-test: ${testError.message}`);
          return;
        }
        
        if (testData?.success) {
          console.log('✅ Yahoo Finance response via yahoo-finance-test:');
          console.log(JSON.stringify(testData, null, 2));
          setResult(JSON.stringify(testData, null, 2));
        } else {
          setResult(`❌ yahoo-finance-test error: ${testData?.error || 'Unknown error'}`);
        }
        return;
      }
      
      console.log('✅ yfinance-yields response:');
      console.log(JSON.stringify(data, null, 2));
      
      const analysis = {
        ticker: ticker,
        success: true,
        timestamp: new Date().toISOString(),
        source: 'yfinance-yields',
        yields: data?.yields || {},
        pltyYield: data?.yields?.[ticker] || 'Not found'
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