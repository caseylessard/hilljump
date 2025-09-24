import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface OrchestrationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message?: string;
}

export const ETFOrchestrator = () => {
  const [tickers, setTickers] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<OrchestrationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();

  const orchestrationSteps: Omit<OrchestrationStep, 'status'>[] = [
    { id: 'fetch-metadata', name: 'Fetch ETF Metadata', message: 'Gathering basic ETF information from external sources' },
    { id: 'configure-eodhd', name: 'Configure EODHD', message: 'Setting up EODHD data source configuration' },
    { id: 'fix-stale-data', name: 'Fix Stale Data', message: 'Updating and refreshing ETF data' },
    { id: 'fetch-enhanced-metadata', name: 'Enhanced Metadata', message: 'Fetching detailed ETF metadata and fundamentals' },
    { id: 'activate-etfs', name: 'Activate ETFs', message: 'Making ETFs visible in rankings and tables' }
  ];

  const initializeSteps = () => {
    setSteps(orchestrationSteps.map(step => ({ ...step, status: 'pending' })));
    setCurrentStep(0);
  };

  const updateStepStatus = (stepIndex: number, status: OrchestrationStep['status'], message?: string) => {
    setSteps(prev => prev.map((step, index) => 
      index === stepIndex 
        ? { ...step, status, message: message || step.message }
        : step
    ));
  };

  const executeStep = async (stepIndex: number, tickerList: string[]): Promise<boolean> => {
    const step = steps[stepIndex];
    if (!step) return false;

    setCurrentStep(stepIndex);
    updateStepStatus(stepIndex, 'running');

    try {
      let result;
      
      switch (step.id) {
        case 'fetch-metadata':
          result = await supabase.functions.invoke('fetch-etf-metadata', {
            body: { tickers: tickerList }
          });
          break;
          
        case 'configure-eodhd':
          result = await supabase.functions.invoke('configure-all-eodhd');
          break;
          
        case 'fix-stale-data':
          result = await supabase.functions.invoke('fix-stale-etfs');
          break;
          
        case 'fetch-enhanced-metadata':
          result = await supabase.functions.invoke('fetch-etf-metadata', {
            body: { tickers: tickerList }
          });
          break;
          
        case 'activate-etfs':
          // Use direct database update for activation
          const { error, count } = await supabase
            .from('etfs')
            .update({ active: true })
            .in('ticker', tickerList)
            .eq('active', false);
          
          if (error) throw error;
          result = { data: { activatedCount: count } };
          break;
          
        default:
          throw new Error(`Unknown step: ${step.id}`);
      }

      if (result.error) {
        throw new Error(result.error.message || `Failed to execute ${step.name}`);
      }

      updateStepStatus(stepIndex, 'completed', `✓ ${step.name} completed successfully`);
      return true;
      
    } catch (error) {
      console.error(`Error in step ${step.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateStepStatus(stepIndex, 'error', `✗ ${step.name} failed: ${errorMessage}`);
      return false;
    }
  };

  const handleOrchestration = async () => {
    if (!tickers.trim()) {
      toast({
        title: "Input required",
        description: "Please enter ticker symbols to import.",
        variant: "destructive",
      });
      return;
    }

    const tickerList = tickers
      .split(/[,\n\r\s]+/)
      .map(ticker => ticker.trim().toUpperCase())
      .filter(ticker => ticker.length > 0);

    if (tickerList.length === 0) {
      toast({
        title: "Invalid input",
        description: "Please enter valid ticker symbols.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    initializeSteps();

    toast({
      title: "ETF Import Started",
      description: `Processing ${tickerList.length} ticker(s): ${tickerList.join(', ')}`,
    });

    try {
      // Execute all steps sequentially
      for (let i = 0; i < orchestrationSteps.length; i++) {
        const success = await executeStep(i, tickerList);
        
        if (!success) {
          toast({
            title: "Import Failed",
            description: `Failed at step: ${orchestrationSteps[i].name}. Check logs for details.`,
            variant: "destructive",
          });
          return;
        }
        
        // Brief delay between steps for better UX
        if (i < orchestrationSteps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: "Import Completed",
        description: `Successfully imported and activated ${tickerList.length} ETF(s)!`,
      });

    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (status: OrchestrationStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const progress = steps.length > 0 ? (steps.filter(s => s.status === 'completed').length / steps.length) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">ETF Import Orchestrator</CardTitle>
        <CardDescription className="text-sm md:text-base">
          Complete ETF onboarding: from ticker list to active rankings in one click
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="tickers" className="text-sm font-medium">
            Ticker Symbols
          </label>
          <Textarea
            id="tickers"
            placeholder="Enter ticker symbols (one per line or comma-separated)&#10;Example:&#10;AAPL&#10;MSFT, GOOGL&#10;TSLA NVDA"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            rows={4}
            disabled={isRunning}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Enter ticker symbols separated by commas, spaces, or new lines
          </p>
        </div>

        {steps.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
            
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-3 p-2 rounded-md border">
                  {getStepIcon(step.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{step.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{step.message}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {index + 1}/{steps.length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleOrchestration}
            disabled={isRunning || !tickers.trim()}
            variant="default"
            className="w-full sm:w-auto text-sm md:text-base"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Import & Activate ETFs'
            )}
          </Button>
          
          {!isRunning && tickers && (
            <Button 
              onClick={() => {setTickers(''); setSteps([]);}}
              variant="outline"
              className="w-full sm:w-auto text-sm md:text-base"
            >
              Clear
            </Button>
          )}
        </div>

        <Alert>
          <AlertDescription className="text-sm md:text-base">
            <strong>What this does:</strong> Fetches complete ETF data, configures data sources, 
            fixes any stale information, gathers enhanced metadata, and activates ETFs for rankings - fully automated.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};