import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Play, Database } from "lucide-react";

export default function DailyAlertsTestSuite() {
  const [isRunning, setIsRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();

  const steps = [
    { id: 'filter-equity', name: 'Filter Equity Universe', icon: '🔍' },
    { id: 'filter-crypto', name: 'Filter Crypto Universe', icon: '🚀' },
    { id: 'scan-equity', name: 'Scan Equity Alerts', icon: '📈' },
    { id: 'scan-crypto', name: 'Scan Crypto Alerts', icon: '⚡' },
    { id: 'view-alerts', name: 'View Generated Alerts', icon: '📊' }
  ];

  const runFullPipeline = async () => {
    setCurrentStep(0);
    setResults({});
    
    try {
      // Step 1: Filter Equity Universe
      setCurrentStep(1);
      setIsRunning('filter-equity');
      
      const equityFilter = await supabase.functions.invoke('filter-equity-universe', {
        body: {
          config: {
            require_float: true,
            min_float: 1_000_000,
            max_float: 15_000_000,
            max_price: 3.00,
            min_avg_dollar_vol: 500_000,
            max_out: 50
          }
        }
      });
      
      if (equityFilter.error) throw new Error(`Equity filter failed: ${equityFilter.error.message}`);
      setResults(prev => ({ ...prev, equityFilter: equityFilter.data }));
      
      // Step 2: Filter Crypto Universe  
      setCurrentStep(2);
      setIsRunning('filter-crypto');
      
      const cryptoFilter = await supabase.functions.invoke('filter-crypto-universe', {
        body: {
          config: {
            top_n: 50,
            min_price: 0.01,
            max_price: 10000,
            min_vol_usd: 2_000_000,
            weights: {
              change: 0.55,
              atr: 0.30,
              volume: 0.15
            }
          }
        }
      });
      
      if (cryptoFilter.error) throw new Error(`Crypto filter failed: ${cryptoFilter.error.message}`);
      setResults(prev => ({ ...prev, cryptoFilter: cryptoFilter.data }));
      
      // Step 3: Scan Equity Alerts
      setCurrentStep(3);
      setIsRunning('scan-equity');
      
      const equityScanner = await supabase.functions.invoke('daily-equity-scanner', {
        body: {
          use_filtered_universe: true,
          config: {
            min_price: 1.0,
            max_price: 50.0,
            min_gap_pct: 1.0,
            weights: {
              gap: 0.5,
              rel_vol: 0.22,
              float: 0.18,
              news: 0.1
            }
          }
        }
      });
      
      if (equityScanner.error) throw new Error(`Equity scanner failed: ${equityScanner.error.message}`);
      setResults(prev => ({ ...prev, equityScanner: equityScanner.data }));
      
      // Step 4: Scan Crypto Alerts
      setCurrentStep(4);
      setIsRunning('scan-crypto');
      
      const cryptoScanner = await supabase.functions.invoke('daily-crypto-scanner', {
        body: {
          use_filtered_universe: true,
          config: {
            min_price: 0.05,
            max_price: 10000,
            min_change_24h_pct: 0.5,
            weights: {
              change: 0.6,
              rel_vol: 0.3,
              news: 0.1
            }
          }
        }
      });
      
      if (cryptoScanner.error) throw new Error(`Crypto scanner failed: ${cryptoScanner.error.message}`);
      setResults(prev => ({ ...prev, cryptoScanner: cryptoScanner.data }));
      
      // Step 5: Check alerts
      setCurrentStep(5);
      setIsRunning('view-alerts');
      
      const { data: equityAlerts } = await supabase
        .from('equity_alerts')
        .select('*')
        .order('rank_order', { ascending: true })
        .limit(5);
        
      const { data: cryptoAlerts } = await supabase
        .from('crypto_alerts')
        .select('*')
        .order('rank_order', { ascending: true })
        .limit(5);
      
      setResults(prev => ({ 
        ...prev, 
        alerts: { 
          equity: equityAlerts || [], 
          crypto: cryptoAlerts || [] 
        } 
      }));
      
      setCurrentStep(6);
      setIsRunning(null);
      
      toast({
        title: "Pipeline Complete! 🎉",
        description: `Generated ${equityAlerts?.length || 0} equity + ${cryptoAlerts?.length || 0} crypto alerts`
      });
      
    } catch (error) {
      console.error('Pipeline error:', error);
      toast({
        title: "Pipeline Error",
        description: error.message,
        variant: "destructive"
      });
      setIsRunning(null);
    }
  };

  const runIndividualStep = async (stepId: string) => {
    setIsRunning(stepId);
    
    try {
      let result;
      switch (stepId) {
        case 'filter-equity':
          result = await supabase.functions.invoke('filter-equity-universe');
          break;
        case 'filter-crypto':
          result = await supabase.functions.invoke('filter-crypto-universe');
          break;
        case 'scan-equity':
          result = await supabase.functions.invoke('daily-equity-scanner', {
            body: { use_filtered_universe: true }
          });
          break;
        case 'scan-crypto':
          result = await supabase.functions.invoke('daily-crypto-scanner', {
            body: { use_filtered_universe: true }
          });
          break;
      }
      
      if (result?.error) throw result.error;
      
      setResults(prev => ({ ...prev, [stepId]: result.data }));
      toast({
        title: "Step Complete",
        description: `${steps.find(s => s.id === stepId)?.name} finished successfully`
      });
      
    } catch (error) {
      console.error(`Error in ${stepId}:`, error);
      toast({
        title: "Step Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Daily Alerts Testing Suite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold mb-2">🚀 Quick Start - Generate Test Data</h4>
              <p className="text-sm text-gray-600 mb-3">
                Run the complete pipeline to generate equity and crypto alerts for testing.
                This will create filtered universes and scan for trading opportunities.
              </p>
              <Button 
                onClick={runFullPipeline} 
                disabled={isRunning !== null}
                className="w-full"
              >
                {isRunning ? `Running... Step ${currentStep}/5` : "🎯 Run Complete Pipeline"}
              </Button>
            </div>

            {/* Pipeline Progress */}
            {currentStep > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Pipeline Progress:</h4>
                <div className="space-y-1">
                  {steps.map((step, index) => {
                    const stepNum = index + 1;
                    const isComplete = currentStep > stepNum;
                    const isActive = currentStep === stepNum;
                    
                    return (
                      <div key={step.id} className={`flex items-center gap-2 p-2 rounded ${
                        isComplete ? 'bg-green-50' : isActive ? 'bg-blue-50' : 'bg-gray-50'
                      }`}>
                        {isComplete ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : isActive ? (
                          <Play className="w-4 h-4 text-blue-600" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                        )}
                        <span className="text-sm">{step.icon} {step.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="individual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="individual">Individual Steps</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="alerts">Generated Alerts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="individual" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {steps.slice(0, 4).map((step) => (
              <Card key={step.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{step.icon} {step.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => runIndividualStep(step.id)}
                    disabled={isRunning === step.id}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isRunning === step.id ? "Running..." : "Run Step"}
                  </Button>
                  {results[step.id] && (
                    <Badge variant="outline" className="mt-2">
                      {results[step.id].success ? "✅ Success" : "❌ Failed"}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="results" className="space-y-4">
          {Object.keys(results).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(results).map(([key, result]) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-sm">{key}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No results yet. Run the pipeline or individual steps to see results.
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          {results.alerts ? (
            <div className="space-y-4">
              {results.alerts.equity.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">📈 Equity Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {results.alerts.equity.map((alert: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm p-2 border rounded">
                          <span>#{alert.rank_order} {alert.ticker}</span>
                          <span>${alert.price?.toFixed(2)} ({alert.premarket_change_pct?.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {results.alerts.crypto.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">⚡ Crypto Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {results.alerts.crypto.map((alert: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm p-2 border rounded">
                          <span>#{alert.rank_order} {alert.symbol}</span>
                          <span>${alert.price?.toFixed(4)} ({alert.change_24h_pct?.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No alerts generated yet. Run the complete pipeline first.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h4 className="font-semibold mb-2">📝 Next Steps After Pipeline Completes:</h4>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>Visit <strong>/breakout</strong> page to see equity alerts</li>
          <li>Visit <strong>/crypto</strong> page to see crypto alerts</li>
          <li>Alerts will show on the main dashboard</li>
          <li>Set up cron jobs to run these functions daily</li>
        </ol>
      </div>
    </div>
  );
}