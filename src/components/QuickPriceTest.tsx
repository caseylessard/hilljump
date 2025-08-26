import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const QuickPriceTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const testQuotesFunction = async () => {
    setLoading(true);
    console.log('🧪 Testing quotes function with AMDY and AIPI...');
    
    try {
      const { data, error } = await supabase.functions.invoke('quotes', {
        body: { tickers: ['AMDY', 'AIPI'] }
      });
      
      console.log('📊 Quotes function response:', data);
      console.log('❌ Quotes function error:', error);
      
      setResults({ data, error, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('💥 Exception calling quotes function:', err);
      setResults({ error: err, timestamp: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 m-4">
      <h3 className="text-lg font-semibold mb-4">Quick Price Test (AMDY & AIPI)</h3>
      
      <Button 
        onClick={testQuotesFunction} 
        disabled={loading}
        className="mb-4"
      >
        {loading ? 'Testing...' : 'Test Quotes Function'}
      </Button>
      
      {results && (
        <div className="space-y-2">
          <p><strong>Timestamp:</strong> {results.timestamp}</p>
          
          {results.data && (
            <div>
              <p><strong>Success:</strong></p>
              <pre className="bg-muted p-2 rounded text-sm overflow-auto">
                {JSON.stringify(results.data, null, 2)}
              </pre>
            </div>
          )}
          
          {results.error && (
            <div>
              <p><strong>Error:</strong></p>
              <pre className="bg-destructive/10 p-2 rounded text-sm overflow-auto">
                {JSON.stringify(results.error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};