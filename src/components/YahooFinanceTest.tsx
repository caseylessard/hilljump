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
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,financialData,defaultKeyStatistics`;
      
      console.log('📊 Fetching Yahoo Finance data for', ticker);
      console.log('🔗 URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      
      console.log('📈 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('✅ Raw Yahoo Finance response for PLTY:');
        console.log(JSON.stringify(data, null, 2));
        
        const quoteSummary = data?.quoteSummary?.result?.[0];
        const summaryDetail = quoteSummary?.summaryDetail;
        const financialData = quoteSummary?.financialData;
        const defaultKeyStatistics = quoteSummary?.defaultKeyStatistics;
        
        const analysis = {
          ticker: ticker,
          summaryDetail: summaryDetail,
          financialData: financialData,
          defaultKeyStatistics: defaultKeyStatistics,
          dividendYield: {
            raw: summaryDetail?.dividendYield?.raw,
            fmt: summaryDetail?.dividendYield?.fmt,
            percentage: summaryDetail?.dividendYield?.raw ? (summaryDetail.dividendYield.raw * 100).toFixed(2) + '%' : 'N/A'
          },
          trailingAnnualDividendRate: summaryDetail?.trailingAnnualDividendRate?.raw,
          trailingAnnualDividendYield: summaryDetail?.trailingAnnualDividendYield?.raw,
          price: summaryDetail?.regularMarketPrice?.raw || financialData?.currentPrice?.raw,
          volume: summaryDetail?.volume?.raw,
          marketCap: summaryDetail?.marketCap?.raw
        };
        
        setResult(JSON.stringify(analysis, null, 2));
        
      } else {
        setResult(`❌ HTTP ${response.status}: ${response.statusText}`);
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