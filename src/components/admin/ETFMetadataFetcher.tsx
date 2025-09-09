import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Database, Download } from "lucide-react";
import { toast } from "sonner";

export default function ETFMetadataFetcher() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFetchMetadata = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      console.log("Starting ETF metadata fetch...");
      
      const { data, error } = await supabase.functions.invoke('fetch-etf-metadata');
      
      if (error) {
        throw error;
      }

      setResult(data);
      
      if (data.success) {
        toast.success(`Updated metadata for ${data.summary.metadataUpdated} ETFs`);
      } else {
        toast.error(data.message || "Failed to fetch metadata");
      }
      
    } catch (error: any) {
      console.error("ETF metadata fetch error:", error);
      const errorMessage = error.message || "Failed to fetch ETF metadata";
      setResult({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          ETF Metadata Fetcher
        </CardTitle>
        <CardDescription>
          Automatically fetch and update ETF metadata including names, categories, 
          summaries, managers, and strategy classifications from external sources.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={handleFetchMetadata}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isRunning ? "Fetching Metadata..." : "Fetch ETF Metadata"}
          </Button>
        </div>

        {result && (
          <Alert className={result.error ? "border-destructive" : "border-green-500"}>
            <AlertDescription>
              {result.error ? (
                <div>
                  <strong>Error:</strong> {result.error}
                </div>
              ) : (
                <div>
                  <strong>Success!</strong> {result.message}
                  {result.summary && (
                    <div className="mt-2 text-sm">
                      <div>• Checked: {result.summary.totalChecked} ETFs</div>
                      <div>• Updated: {result.summary.metadataUpdated} ETFs</div>
                      <div>• Skipped: {result.summary.skipped} ETFs</div>
                    </div>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground">
          <p>This tool will:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Find ETFs with missing metadata (name, category, summary, etc.)</li>
            <li>Fetch comprehensive data from Yahoo Finance and Alpha Vantage</li>
            <li>Update ETF records with fund names, categories, and descriptions</li>
            <li>Classify strategies and identify fund managers/providers</li>
            <li>Process ETFs in small batches to respect API rate limits</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}