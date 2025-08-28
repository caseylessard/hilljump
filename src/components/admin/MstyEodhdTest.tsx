import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function MstyEodhdTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  const testMstyEodhd = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing EODHD Premium Data Quality for MSTY...');
      const { data, error } = await supabase.functions.invoke('test-msty-eodhd', {
        body: {}
      });
      
      if (error) {
        console.error('Error:', error);
        toast.error(`Error: ${error.message}`);
      } else {
        console.log('EODHD Test Results:', data);
        setResults(data);
        toast.success('EODHD test completed successfully!');
      }
    } catch (err) {
      console.error('Catch error:', err);
      toast.error('Failed to test EODHD data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>MSTY EODHD Premium Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testMstyEodhd} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Testing EODHD...' : 'Test MSTY with EODHD Premium'}
        </Button>
        
        {results && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Data Quality Comparison</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-destructive">Current System:</h5>
                  <p>Price: {results.comparison?.current_system?.price}</p>
                  <p>Age: {results.comparison?.current_system?.age}</p>
                  <p>Source: {results.comparison?.current_system?.source}</p>
                </div>
                <div>
                  <h5 className="font-medium text-primary">EODHD Premium:</h5>
                  <p>Price: {results.comparison?.eodhd_premium?.price}</p>
                  <p>Age: {results.comparison?.eodhd_premium?.age}</p>
                  <p>Source: {results.comparison?.eodhd_premium?.source}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">API Usage Efficiency</h4>
              <div className="text-sm">
                <p>Daily calls for 192 ETFs: {results.api_usage?.estimated_daily_for_192_etfs}</p>
                <p>% of 100K limit: {results.api_usage?.percentage_of_100k_limit}</p>
              </div>
            </div>
            
            <details className="cursor-pointer">
              <summary className="font-medium">Full Test Results</summary>
              <pre className="text-xs bg-background p-4 rounded border mt-2 overflow-auto max-h-96">
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}