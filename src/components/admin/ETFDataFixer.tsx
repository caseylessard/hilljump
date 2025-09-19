import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Database } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const ETFDataFixer = () => {
  const [isFixing, setIsFixing] = useState(false);
  const [isConfiguringEODHD, setIsConfiguringEODHD] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [eodhdResults, setEodhdResults] = useState<any>(null);

  const handleFixStaleETFs = async () => {
    setIsFixing(true);
    setResults(null);
    
    try {
      toast.info("Fixing stale ETF data and EODHD configurations...");
      
      const { data, error } = await supabase.functions.invoke('fix-stale-etfs');
      
      if (error) {
        console.error('ETF fix error:', error);
        toast.error(`Failed to fix ETFs: ${error.message}`);
      } else {
        console.log('ETF fix result:', data);
        setResults(data);
        toast.success(`ETF fixes completed! Fixed ${data.summary?.total_fixes || 0} ETFs.`);
      }
    } catch (error) {
      console.error('ETF fix failed:', error);
      toast.error(`ETF fix failed: ${error.message}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleConfigureAllEODHD = async () => {
    setIsConfiguringEODHD(true);
    setEodhdResults(null);
    
    try {
      toast.info("Configuring EODHD for all active ETFs...");
      
      const { data, error } = await supabase.functions.invoke('configure-all-eodhd');
      
      if (error) {
        console.error('EODHD configuration error:', error);
        toast.error(`Failed to configure EODHD: ${error.message}`);
      } else {
        console.log('EODHD configuration result:', data);
        setEodhdResults(data);
        toast.success(`EODHD configured for ${data.summary?.configured || 0}/${data.summary?.total_etfs} ETFs!`);
      }
    } catch (error) {
      console.error('EODHD configuration failed:', error);
      toast.error(`EODHD configuration failed: ${error.message}`);
    } finally {
      setIsConfiguringEODHD(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* EODHD Configuration for All ETFs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            Configure EODHD for All ETFs
          </CardTitle>
          <CardDescription>
            Configure all 221 active ETFs to use EODHD as the primary data source (recommended since you pay for it)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              <strong>Bulk EODHD Configuration:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>US ETFs</strong> (123): TICKER.US format</li>
                <li><strong>Canadian TSX</strong> (68): TICKER.TO format</li>
                <li><strong>Canadian NEO</strong> (30): TICKER.NEO format</li>
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                This will set all ETFs to use your premium EODHD subscription instead of free sources.
              </p>
            </AlertDescription>
          </Alert>
          
          <Button
            onClick={handleConfigureAllEODHD}
            disabled={isConfiguringEODHD}
            className="w-full"
          >
            <Database className={`h-4 w-4 mr-2 ${isConfiguringEODHD ? 'animate-pulse' : ''}`} />
            {isConfiguringEODHD ? "Configuring EODHD..." : "Configure All ETFs for EODHD"}
          </Button>

          {eodhdResults && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>EODHD Configuration Results:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Total ETFs: {eodhdResults.summary?.total_etfs || 0}</li>
                    <li>Successfully configured: {eodhdResults.summary?.configured || 0}</li>
                    <li>Errors: {eodhdResults.summary?.errors || 0}</li>
                    <li>US ETFs: {eodhdResults.summary?.breakdown?.us_etfs || 0}</li>
                    <li>Canadian TSX: {eodhdResults.summary?.breakdown?.canadian_tsx || 0}</li>
                    <li>Canadian NEO: {eodhdResults.summary?.breakdown?.canadian_neo || 0}</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Stale ETF Fixes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Fix Stale ETF Data
          </CardTitle>
          <CardDescription>
            Deactivate delisted ETFs and fix specific ETFs with missing price data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Deactivate QDCC</strong> - appears delisted (25 days stale, identical prices)</li>
              <li><strong>Configure EODHD</strong> for 8 Canadian ETFs missing recent data</li>
              <li><strong>Configure EODHD</strong> for SQY (US) missing recent data</li>
            </ul>
          </AlertDescription>
        </Alert>
        
        <Button
          onClick={handleFixStaleETFs}
          disabled={isFixing}
          variant="destructive"
          className="w-full"
        >
          <AlertTriangle className={`h-4 w-4 mr-2 ${isFixing ? 'animate-pulse' : ''}`} />
          {isFixing ? "Fixing ETF Data..." : "Fix Stale ETF Data"}
        </Button>

        {results && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Fix Results:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>QDCC deactivated: {results.summary?.qdcc_deactivated ? '✅ Yes' : '❌ No'}</li>
                  <li>Canadian ETFs configured: {results.summary?.canadian_etfs_configured || 0}/8</li>
                  <li>SQY configured: {results.summary?.sqy_configured ? '✅ Yes' : '❌ No'}</li>
                  <li><strong>Total fixes: {results.summary?.total_fixes || 0}</strong></li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
        </CardContent>
      </Card>
    </div>
  );
};