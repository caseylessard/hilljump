import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const ETFDataFixer = () => {
  const [isFixing, setIsFixing] = useState(false);
  const [results, setResults] = useState<any>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Fix Stale ETF Data
        </CardTitle>
        <CardDescription>
          Deactivate delisted ETFs and configure EODHD data sources for ETFs with missing price data
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
  );
};