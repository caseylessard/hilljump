import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navigation from "@/components/Navigation";
import { useAdmin } from "@/hooks/useAdmin";
import { Navigate } from "react-router-dom";

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

const AdminDashboard = () => {
  const { isAdmin, loading } = useAdmin();

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
      
      <main className="container py-4 md:py-8 px-4 md:px-6">
        <div className="space-y-4 md:space-y-6">
          <div className="px-2 md:px-0">
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">System management and data administration</p>
          </div>

          <Tabs defaultValue="data" className="space-y-4 md:space-y-6 px-2 md:px-0">
            <TabsList className="grid w-full grid-cols-6 md:grid-cols-6 sm:grid-cols-2 overflow-x-auto">
              <TabsTrigger value="data" className="text-xs sm:text-sm">Data</TabsTrigger>
              <TabsTrigger value="dividends" className="text-xs sm:text-sm">Dividends</TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs sm:text-sm">Pricing</TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs sm:text-sm">Alerts</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
              <TabsTrigger value="monitoring" className="text-xs sm:text-sm">Monitor</TabsTrigger>
            </TabsList>

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
    </div>
  );
};

export default AdminDashboard;