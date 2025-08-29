import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function ShowDripWork() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [ticker1, setTicker1] = useState('NVHE.TO');
  const [ticker2, setTicker2] = useState('YBTC');
  const [taxCountry, setTaxCountry] = useState('US');
  const [withTax, setWithTax] = useState(true);
  const [taxRate, setTaxRate] = useState(15.0);
  
  const calculateDrip = async () => {
    if (!ticker1.trim() || !ticker2.trim()) {
      toast.error('Please enter both tickers');
      return;
    }

    setLoading(true);
    setResults(null);
    
    try {
      const tickers = [ticker1.trim().toUpperCase(), ticker2.trim().toUpperCase()];
      console.log(`🧮 Calculating DRIP for ${tickers.join(' and ')} (${taxCountry} client ${withTax ? 'with' : 'without'} tax)...`);
      
      const { data, error } = await supabase.functions.invoke('calculate-drip', {
        body: { 
          tickers: tickers,
          taxPrefs: {
            country: taxCountry,
            withholdingTax: withTax,
            taxRate: taxRate
          }
        }
      });
      
      if (error) {
        console.error('Error:', error);
        toast.error(`Error: ${error.message}`);
      } else {
        console.log('DRIP Results:', data);
        setResults(data);
        toast.success('DRIP calculations completed');
      }
    } catch (err) {
      console.error('Catch error:', err);
      toast.error('Failed to calculate DRIP');
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatDollar = (value: number | undefined | null) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>52-Week DRIP Calculations - Compare Two Tickers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select any two tickers and tax preferences to compare their DRIP performance
          </p>
        </CardHeader>
        <CardContent>
          {/* Ticker Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="ticker1">First Ticker</Label>
              <Input
                id="ticker1"
                value={ticker1}
                onChange={(e) => setTicker1(e.target.value)}
                placeholder="e.g. NVHE.TO"
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticker2">Second Ticker</Label>
              <Input
                id="ticker2"
                value={ticker2}
                onChange={(e) => setTicker2(e.target.value)}
                placeholder="e.g. YBTC"
                className="uppercase"
              />
            </div>
          </div>

          {/* Tax Preferences */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="taxCountry">Client Country</Label>
              <Select value={taxCountry} onValueChange={setTaxCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">🇺🇸 United States</SelectItem>
                  <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withTax">Withholding Tax</Label>
              <Select value={withTax.toString()} onValueChange={(value) => setWithTax(value === 'true')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Apply Tax</SelectItem>
                  <SelectItem value="false">No Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                placeholder="15.0"
                step="0.1"
                min="0"
                max="50"
              />
            </div>
          </div>

          <Button 
            onClick={calculateDrip} 
            disabled={loading || !ticker1.trim() || !ticker2.trim()}
            className="w-full mb-4"
          >
            {loading ? 'Calculating...' : `Calculate & Compare ${ticker1.toUpperCase()} vs ${ticker2.toUpperCase()}`}
          </Button>

          {results && (
            <div className="space-y-6">
              <div className="text-sm bg-muted p-4 rounded flex justify-between items-center">
                <div>
                  <strong>Summary:</strong> Processed {results.processed || 0} tickers | 
                  Errors: {results.errors?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  {taxCountry} client • {withTax ? `${taxRate}% tax` : 'No tax'}
                </div>
              </div>

              {results.dripData && Object.entries(results.dripData).map(([ticker, data]: [string, any]) => (
                <Card key={ticker} className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{ticker}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {ticker.includes('.TO') ? 
                          `🇨🇦 Canadian Fund ${withTax ? `(${taxRate}% tax)` : '(No tax)'}` : 
                          `🇺🇸 US Fund ${withTax && taxCountry === 'CA' ? `(${taxRate}% tax)` : '(No tax)'}`
                        }
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    
                    {/* 52-Week Results */}
                    <div className="bg-green-50 border border-green-200 p-4 rounded">
                      <h4 className="font-semibold text-green-800 mb-2">52-Week DRIP Performance</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Percentage Return:</span>
                          <div className="text-lg font-bold text-green-600">
                            {formatPercent(data.drip52wPercent)}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Dollar Value:</span>
                          <div className="text-lg font-bold text-green-600">
                            {formatDollar(data.drip52wDollar)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* All Periods Comparison */}
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div className="bg-blue-50 p-3 rounded text-center">
                        <div className="font-medium">4 Weeks</div>
                        <div className="text-blue-600 font-bold">{formatPercent(data.drip4wPercent)}</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded text-center">
                        <div className="font-medium">13 Weeks</div>
                        <div className="text-blue-600 font-bold">{formatPercent(data.drip13wPercent)}</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded text-center">
                        <div className="font-medium">26 Weeks</div>
                        <div className="text-blue-600 font-bold">{formatPercent(data.drip26wPercent)}</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded text-center border-2 border-green-200">
                        <div className="font-medium">52 Weeks</div>
                        <div className="text-green-600 font-bold">{formatPercent(data.drip52wPercent)}</div>
                      </div>
                    </div>

                    {/* Reinvestment Details */}
                    {data.audit && data.audit.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-medium">Recent Dividend Reinvestments:</h5>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {data.audit.slice(-15).reverse().map((event: any, i: number) => (
                            <div key={i} className="bg-gray-50 p-2 rounded text-xs border-l-4 border-blue-400">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{event.date}</span>
                                <span className="text-muted-foreground">{event.type}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {event.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tax Impact Explanation */}
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm">
                      <h5 className="font-medium text-yellow-800 mb-1">Tax Impact:</h5>
                      <p className="text-yellow-700">
                        {(() => {
                          const isCanadianFund = ticker.includes('.TO');
                          const isUSClient = taxCountry === 'US';
                          const isCAClient = taxCountry === 'CA';
                          
                          if (isCanadianFund && isUSClient && withTax) {
                            return `🇨🇦➡️🇺🇸 Canadian fund, US client: ${taxRate}% withholding tax applied to all dividends`;
                          } else if (!isCanadianFund && isCAClient && withTax) {
                            return `🇺🇸➡️🇨🇦 US fund, Canadian client: ${taxRate}% withholding tax applied to all dividends`;
                          } else if (!withTax) {
                            return `No withholding tax applied (tax disabled)`;
                          } else {
                            return `No withholding tax (domestic ${isCanadianFund ? 'Canadian' : 'US'} fund for ${taxCountry} client)`;
                          }
                        })()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {results.errors && results.errors.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600">Calculation Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {results.errors.map((error: any, i: number) => (
                        <div key={i} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          <strong>{error.ticker}:</strong> {error.error}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}