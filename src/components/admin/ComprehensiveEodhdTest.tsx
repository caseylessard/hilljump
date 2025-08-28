import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function ComprehensiveEodhdTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  const testEodhdIntegration = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testing comprehensive EODHD integration...');
      
      // Test multiple tickers from different categories
      const testTickers = [
        'MSTY',    // US Covered Call ETF
        'XYLD',    // US High Yield
        'QYLD',    // US NASDAQ Yield
        'TSLY',    // US Tesla Yield
        'JEPI',    // US JPMorgan Equity Premium
        'TDB902.TO', // Canadian Bond
        'VTI.US',    // US Total Market (test .US suffix)
      ];
      
      // Test the main quotes function (now EODHD-first)
      const { data: quotesData, error: quotesError } = await supabase.functions.invoke('quotes', {
        body: { tickers: testTickers }
      });
      
      if (quotesError) {
        throw new Error(`Quotes function failed: ${quotesError.message}`);
      }
      
      // Test smart price updater (hybrid approach)
      const { data: smartData, error: smartError } = await supabase.functions.invoke('smart-price-updater', {
        body: { tickers: testTickers.slice(0, 3) } // Test smaller subset for hybrid approach
      });
      
      // Test individual MSTY data quality
      const { data: mstyData, error: mstyError } = await supabase.functions.invoke('test-msty-eodhd', {
        body: {}
      });
      
      const testResults = {
        timestamp: new Date().toISOString(),
        quotes_function: {
          success: !quotesError,
          error: quotesError?.message,
          prices_found: quotesData?.prices ? Object.keys(quotesData.prices).length : 0,
          sample_prices: quotesData?.prices ? Object.entries(quotesData.prices).slice(0, 3) : [],
          all_prices: quotesData?.prices
        },
        hybrid_updater: {
          success: !smartError,
          error: smartError?.message,
          summary: smartData?.summary,
          source_breakdown: smartData?.summary?.sourceBreakdown,
          message: smartData?.message
        },
        msty_quality_test: {
          success: !mstyError,
          error: mstyError?.message,
          real_time_price: mstyData?.realtime_price?.price,
          comparison: mstyData?.comparison,
          api_usage: mstyData?.api_usage
        },
        analysis: {
          total_tickers_tested: testTickers.length,
          eodhd_success_rate: quotesData?.prices ? 
            (Object.keys(quotesData.prices).length / testTickers.length * 100).toFixed(1) + '%' : 
            '0%',
          recommendations: []
        }
      };
      
      // Generate recommendations
      if (testResults.quotes_function.prices_found === testTickers.length) {
        testResults.analysis.recommendations.push('✅ EODHD integration working perfectly for all test tickers');
      } else if (testResults.quotes_function.prices_found > 0) {
        testResults.analysis.recommendations.push(`⚠️ EODHD working for ${testResults.quotes_function.prices_found}/${testTickers.length} tickers - check failed ones`);
      } else {
        testResults.analysis.recommendations.push('❌ EODHD integration needs attention - no prices retrieved');
      }
      
      if (testResults.hybrid_updater.source_breakdown?.eodhd_prices > 0) {
        testResults.analysis.recommendations.push(`📊 Hybrid updater using EODHD prices for ${testResults.hybrid_updater.source_breakdown.eodhd_prices} tickers + Yahoo fundamentals for ${testResults.hybrid_updater.source_breakdown.yahoo_fundamentals || 0}`);
      }
      
      if (testResults.msty_quality_test.real_time_price) {
        testResults.analysis.recommendations.push(`💰 MSTY real-time price: $${testResults.msty_quality_test.real_time_price} (professional grade)`);
      }
      
      setResults(testResults);
      
      if (testResults.quotes_function.success && testResults.quotes_function.prices_found > 0) {
        toast.success(`EODHD integration test successful! Retrieved ${testResults.quotes_function.prices_found} prices.`);
      } else {
        toast.error('EODHD integration test had issues - check results');
      }
      
    } catch (err) {
      console.error('Comprehensive EODHD test error:', err);
      toast.error('Failed to run comprehensive EODHD test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Comprehensive EODHD Integration Test 
          <Badge variant="outline">Hybrid Approach</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testEodhdIntegration} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Testing Hybrid EODHD Integration...' : 'Run Comprehensive EODHD Test'}
        </Button>
        
        {results && (
          <div className="space-y-4">
            {/* Success Summary */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">Test Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Tickers Tested:</span> {results.analysis.total_tickers_tested}
                </div>
                <div>
                  <span className="font-medium">Success Rate:</span> {results.analysis.eodhd_success_rate}
                </div>
                <div>
                  <span className="font-medium">Quotes Function:</span> 
                  {results.quotes_function.success ? ' ✅ Working' : ' ❌ Failed'}
                </div>
                <div>
                  <span className="font-medium">Hybrid Updater:</span> 
                  {results.hybrid_updater.success ? ' ✅ Working' : ' ❌ Failed'}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {results.analysis.recommendations.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Analysis & Recommendations</h4>
                <ul className="space-y-1 text-sm">
                  {results.analysis.recommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sample Prices */}
            {results.quotes_function.sample_prices.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Sample EODHD Prices</h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {results.quotes_function.sample_prices.map(([ticker, price]: [string, number]) => (
                    <div key={ticker} className="flex justify-between">
                      <span className="font-mono">{ticker}:</span>
                      <span className="text-primary font-medium">${price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* API Usage Stats */}
            {results.msty_quality_test.api_usage && (
              <div className="p-4 bg-accent/10 rounded-lg">
                <h4 className="font-semibold mb-2">API Usage Efficiency</h4>
                <div className="text-sm space-y-1">
                  <div>Daily estimate for 192 ETFs: {results.msty_quality_test.api_usage.estimated_daily_for_192_etfs} calls</div>
                  <div>% of 100K limit: {results.msty_quality_test.api_usage.percentage_of_100k_limit}</div>
                </div>
              </div>
            )}
            
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