import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const TestCanadianPrices = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const testPrices = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      // Test a small sample of Canadian tickers that were failing
      const testTickers = ["BCCL.NE", "CDAY.NE", "EACL.NE", "EBNK.TO"];
      
      console.log("🧪 Testing Canadian prices with Alpha Vantage...");
      const { data, error } = await supabase.functions.invoke("quotes", {
        body: { tickers: testTickers }
      });
      
      if (error) throw error;
      
      console.log("✅ Test results:", data);
      setResults(data);
      
      const successCount = Object.keys(data?.prices || {}).length;
      toast.success(`Successfully fetched ${successCount}/${testTickers.length} Canadian prices`);
      
    } catch (error) {
      console.error("❌ Test failed:", error);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Test Canadian Price Fetching</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testPrices} 
          disabled={testing}
          className="w-full"
        >
          {testing ? "Testing..." : "Test Canadian Tickers (BCCL.NE, CDAY.NE, EACL.NE, EBNK.TO)"}
        </Button>
        
        {results && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="font-semibold mb-2">Test Results:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestCanadianPrices;