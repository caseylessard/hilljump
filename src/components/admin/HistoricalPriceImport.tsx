import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export function HistoricalPriceImport() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setLoading(true);
    try {
      const csvData = await file.text();
      
      console.log('📊 Importing historical prices...');
      const { data, error } = await supabase.functions.invoke('import-historical-prices', {
        body: { csvData }
      });
      
      if (error) {
        console.error('Import error:', error);
        toast.error(`Import failed: ${error.message}`);
        return;
      }
      
      setResult(data);
      toast.success(`Successfully imported ${data?.processed || 0} price records!`);
      
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to import historical prices');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Historical Prices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Upload a CSV file with historical price data. Required: ticker, date, close. Optional: open, high, low, adj close, volume</p>
          <code className="block bg-muted p-2 rounded text-xs">
            ticker,date,open,high,low,close,adj close,volume<br/>
            XYLD,2024-01-01,45.50,46.20,45.10,45.23,45.20,1000000<br/>
            QYLD,2024-01-01,17.95,18.10,17.85,17.89,17.87,850000
          </code>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name}
              </div>
            )}
          </div>

          <Button 
            onClick={handleImport} 
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? 'Importing...' : 'Import Historical Prices'}
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-semibold">Import Results</span>
            </div>
            <div className="space-y-1 text-sm">
              <p>✅ Records processed: {result.processed}</p>
              <p>✅ Records inserted: {result.inserted}</p>
              <p>✅ Records updated: {result.updated}</p>
              {result.errors > 0 && (
                <p className="text-destructive">⚠️ Errors: {result.errors}</p>
              )}
            </div>
            
            {result.sample && result.sample.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-sm mb-2">Sample imported data:</p>
                <div className="text-xs bg-muted p-2 rounded max-h-32 overflow-y-auto">
                  {result.sample.map((row: any, idx: number) => (
                    <div key={idx}>
                      {row.ticker}: {row.date} = ${row.close}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}