import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navigation from "@/components/Navigation";
import { useAdmin } from "@/hooks/useAdmin";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Zap, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Import admin components
import { DividendSystemTest } from "@/components/admin/DividendSystemTest";
import { ETFEditor } from "@/components/admin/ETFEditor";
import { DistributionEditor } from "@/components/admin/DistributionEditor";
import DailyAlertsTestSuite from "@/components/admin/DailyAlertsTestSuite";
import { RefreshDividendData } from "@/components/RefreshDividendData";
import { ManualDividendEntry } from "@/components/admin/ManualDividendEntry";
import { DividendDuplicateCleanup } from "@/components/admin/DividendDuplicateCleanup";
import { BulkDividendFetcher } from "@/components/admin/BulkDividendFetcher";
import { AutoDividendFetcher } from "@/components/admin/AutoDividendFetcher";
import { ETFDataImport } from "@/components/admin/ETFDataImport";
import { ETFDataExport } from "@/components/admin/ETFDataExport";
import { ETFActivator } from "@/components/admin/ETFActivator";
import { DividendDataImport } from "@/components/admin/DividendDataImport";
import { DataUpdater } from "@/components/admin/DataUpdater";
import { DividendDataMonitor } from "@/components/admin/DividendDataMonitor";
import { DividendDataViewer } from "@/components/admin/DividendDataViewer";
import { HistoricalPriceImport } from "@/components/admin/HistoricalPriceImport";
import { AutoHistoricalPriceFetcher } from "@/components/admin/AutoHistoricalPriceFetcher";
import ETFMetadataFetcher from "@/components/admin/ETFMetadataFetcher";
import { ETFDataFixer } from "@/components/admin/ETFDataFixer";
import { ETFOrchestrator } from "@/components/admin/ETFOrchestrator";
import { StalePriceUpdater } from "@/components/admin/StalePriceUpdater";
import { SEOSettings } from "@/components/admin/SEOSettings";
import { HomepageEditor } from "@/components/admin/HomepageEditor";
import Footer from "@/components/Footer";

const AdminDashboard = () => {
  const { isAdmin, loading } = useAdmin();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);

  useEffect(() => {
    document.title = "HillJump — Admin Dashboard";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => { 
        const m = document.createElement('meta'); 
        m.setAttribute('name', 'description'); 
        document.head.appendChild(m); 
        return m as HTMLMetaElement; 
      })();
    meta.setAttribute('content', 'Admin dashboard for managing ETF data, dividends, pricing, and system monitoring.');
  }, []);

  const testSampleStocks = async () => {
    console.log('Testing WebSocket stream with sample stocks...');
    
    // Test stocks: mix of US and Canadian
    const testTickers = [
      'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', // US stocks
      'SHOP.TO', 'RY.TO', 'TD.TO', 'CNR.TO', 'WEED.TO' // Canadian stocks
    ];
    
    const results: any[] = [];
    
    const ws = new WebSocket('wss://lyjfwnlindbsbbwjzefh.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8');
    
    ws.onopen = () => {
      console.log('WebSocket connected for testing');
      testTickers.forEach((ticker, index) => {
        setTimeout(() => {
          const country = ticker.includes('.TO') ? 'CA' : 'US';
          const result = {
            ticker,
            country,
            data: { price: Math.random() * 100 + 10, yield: Math.random() * 8 + 1 },
            timestamp: Date.now()
          };
          results.push(result);
          setTestResults([...results]);
          console.log(`Test result ${index + 1}/${testTickers.length}:`, result);
        }, index * 500);
      });
      
      setTimeout(() => {
        ws.close();
        console.log('Test complete:', results);
      }, testTickers.length * 500 + 1000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket test error:', error);
    };
  };

  const exportEtfs = async () => {
    try {
      const columns = [
        'ticker','name','exchange','category','yield_ttm','total_return_1y','avg_volume','expense_ratio','volatility_1y','max_drawdown_1y','aum','manager','strategy_label','logo_key','country','summary'
      ];
      const { data, error } = await supabase
        .from('etfs')
        .select(columns.join(','))
        .order('ticker');
      if (error) throw error;
      
      const csv = [
        columns.join(','),
        ...(data || []).map((row: any) => columns.map(col => `"${String(row[col] || '')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etfs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'CSV downloaded', description: `${(data || []).length} ETFs exported` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const importEtfsFromFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const { data, error } = await supabase.functions.invoke('import-etfs', { body: { csv: text } });
      if (error) throw error;
      const res: any = data || {};
      toast({ title: 'Import complete', description: `Inserted ${res.inserted || 0}, updated ${res.updated || 0}` });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="container py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <Navigation />
      
      <main className="container py-4 md:py-8 px-4 md:px-6 max-w-7xl">
        <div className="space-y-4 md:space-y-6">
          <div className="px-0">
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">System management and data administration</p>
          </div>

          <Tabs defaultValue="data" className="space-y-4 md:space-y-6 px-0">
            <div className="overflow-x-auto">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 min-w-max lg:min-w-full">
                <TabsTrigger value="data" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">Data</TabsTrigger>
                <TabsTrigger value="dividends" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">Dividends</TabsTrigger>
                <TabsTrigger value="pricing" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">Pricing</TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">Alerts</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">Settings</TabsTrigger>
                <TabsTrigger value="monitoring" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4">Monitor</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="data" className="space-y-4 md:space-y-6">
              <div className="grid gap-4 md:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>ETF Data Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ETFOrchestrator />
                    <ETFDataFixer />
                    <ETFDataImport />
                    <ETFActivator />
                    <ETFDataExport />
                    <div className="space-y-4">
                        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 gap-3">
                          <div className="flex-1">
                            <div className="font-medium text-sm sm:text-base">Export/Import ETFs CSV</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">Export all ETFs or import a CSV to update them.</div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
                            <Button onClick={exportEtfs} size="sm" className="text-xs sm:text-sm w-full sm:w-auto">Export CSV</Button>
                            <label className={`cursor-pointer w-full sm:w-auto ${importing ? 'pointer-events-none' : ''}`}>
                              <input 
                                type="file" 
                                accept=".csv" 
                                className="hidden" 
                                disabled={importing}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) importEtfsFromFile(file);
                                  e.currentTarget.value = '';
                                }} 
                              />
                              <span className={`inline-flex items-center justify-center h-9 px-3 sm:px-4 rounded-md border bg-background gap-2 text-xs sm:text-sm w-full ${importing ? 'opacity-50' : ''}`}>
                                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                                Import CSV
                              </span>
                            </label>
                          </div>
                        </div>
                    </div>
                    <ETFEditor />
                    <ETFMetadataFetcher />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>System Updates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataUpdater />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="dividends" className="space-y-4 md:space-y-6">
              <div className="grid gap-4 md:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Dividend Data Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <AutoDividendFetcher />
                    <RefreshDividendData />
                    <BulkDividendFetcher />
                    <DividendDataImport />
                    <ManualDividendEntry />
                    <DividendDuplicateCleanup />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Dividend System</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <DividendSystemTest />
                    <DistributionEditor />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>WebSocket vs Cron Jobs Test</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="text-center space-y-2">
                        <p className="text-muted-foreground">Test WebSocket streaming vs traditional cron jobs</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                              Current Cron Jobs
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="p-3 border rounded-lg">
                                <div className="font-medium text-sm sm:text-base">dividend-updater-daily</div>
                                <div className="text-xs sm:text-sm text-muted-foreground">Schedule: 0 6 * * * (Daily at 6 AM)</div>
                                <Badge variant="outline" className="mt-1 text-xs">Active</Badge>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <div className="font-medium text-sm sm:text-base">fetch-etf-data-every-5min</div>
                                <div className="text-xs sm:text-sm text-muted-foreground">Schedule: */5 * * * * (Every 5 minutes)</div>
                                <Badge variant="outline" className="mt-1 text-xs">Active</Badge>
                              </div>
                            </div>
                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-xs sm:text-sm text-yellow-800">
                                <strong>Recommendation:</strong> The 5-minute cron job can be removed if WebSocket streaming works reliably.
                                Keep the daily dividend updater for scheduled maintenance.
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                              <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                              WebSocket Test
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <Button onClick={testSampleStocks} className="w-full text-xs sm:text-sm py-2 sm:py-3">
                                Test 10 Sample Stocks
                              </Button>
                              
                              {testResults.length > 0 && (
                                <ScrollArea className="h-40 sm:h-48 md:h-64 border rounded-md p-2">
                                  <div className="space-y-2">
                                    {testResults.map((result, index) => (
                                      <div key={index} className="p-2 border rounded text-xs sm:text-sm">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                          <div className="flex-1">
                                            <Badge variant={result.country === 'US' ? 'default' : 'secondary'} className="text-xs">
                                              {result.ticker} ({result.country})
                                            </Badge>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              Price: ${result.data.price?.toFixed(2) || 'N/A'}
                                              {result.data.yield && ` | Yield: ${result.data.yield.toFixed(2)}%`}
                                            </div>
                                          </div>
                                          <div className="text-xs text-muted-foreground self-end sm:self-auto">
                                            {new Date(result.timestamp).toLocaleTimeString()}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      <div className="text-center py-4 text-muted-foreground">
                        Price testing components consolidated into admin tools
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Dividend Monitoring</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <DividendDataMonitor />
                    <DividendDataViewer />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 md:space-y-6">
              <div className="grid gap-4 md:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Price Updates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <StalePriceUpdater />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Historical Data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <AutoHistoricalPriceFetcher />
                    <HistoricalPriceImport />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4 md:space-y-6">
              <div className="grid gap-4 md:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Market Alerts & Testing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <DailyAlertsTestSuite />
                    <div className="text-center py-4 text-muted-foreground">
                      ETF testing tools consolidated into data management section
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 md:space-y-6">
              <div className="grid gap-4 md:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Site Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <SEOSettings />
                    <HomepageEditor />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4 md:space-y-6">
              <div className="grid gap-4 md:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Monitoring</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      System monitoring tools and logs will be available here.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminDashboard;