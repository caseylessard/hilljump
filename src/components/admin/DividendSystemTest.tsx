import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const DividendSystemTest = () => {
  const [testing, setTesting] = useState(false);
  const [ticker, setTicker] = useState('SMCY');
  const [results, setResults] = useState<any>(null);

  const testDividendFetch = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      console.log(`Testing dividend fetch for ${ticker}...`);
      
      // Test the dividend-updater function
      const { data, error } = await supabase.functions.invoke('dividend-updater', {
        body: { ticker }
      });
      
      if (error) {
        console.error('Dividend updater error:', error);
        setResults({ error: error.message });
        toast.error(`Dividend updater failed: ${error.message}`);
        return;
      }
      
      console.log('Dividend updater response:', data);
      setResults(data);
      
      // Query recent dividends for the ticker
      const { data: dividends, error: divError } = await supabase
        .from('dividends')
        .select('*')
        .eq('ticker', ticker)
        .order('ex_date', { ascending: false })
        .limit(5);
        
      if (divError) {
        console.error('Query error:', divError);
      } else {
        setResults(prev => ({ ...prev, recentDividends: dividends }));
      }
      
      toast.success('Dividend test completed');
      
    } catch (error: any) {
      console.error('Test error:', error);
      setResults({ error: error.message });
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const testYahooDirectly = async () => {
    setTesting(true);
    
    try {
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - (365 * 24 * 60 * 60); // 1 year ago
      
      const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d&events=div`;
      
      console.log('Testing Yahoo Finance directly:', url);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const csvText = await response.text();
      console.log('Yahoo response:', csvText);
      
      setResults({ yahooResponse: csvText, responseStatus: response.status });
      
    } catch (error: any) {
      console.error('Yahoo test error:', error);
      setResults({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dividend System Test</CardTitle>
        <CardDescription>
          Test dividend fetching system and check for recent updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter ticker (e.g., SMCY)"
            className="flex-1"
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={testDividendFetch}
            disabled={testing || !ticker}
          >
            {testing ? 'Testing...' : 'Test Dividend Updater'}
          </Button>
          
          <Button 
            onClick={testYahooDirectly}
            disabled={testing || !ticker}
            variant="outline"
          >
            Test Yahoo Direct
          </Button>
        </div>

        {results && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <h4 className="font-semibold mb-2">Test Results:</h4>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
            
            {results.recentDividends && (
              <div>
                <h4 className="font-semibold mb-2">Recent Dividends in DB:</h4>
                <div className="space-y-2">
                  {results.recentDividends.map((div: any, idx: number) => (
                    <div key={idx} className="text-sm bg-muted/50 p-2 rounded">
                      {div.ex_date}: ${div.amount} ({div.cash_currency})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};