import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Check, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export const ETFDataImport = () => {
  const [csvData, setCsvData] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    inserted?: number;
    errors?: number;
  } | null>(null);

  const handleImport = async () => {
    if (!csvData.trim()) {
      setResult({
        success: false,
        message: 'Please paste CSV data before importing.'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult({
          success: false,
          message: 'You must be logged in to import data.'
        });
        return;
      }

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('import-complete-etfs', {
        body: { csvData },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      setResult({
        success: true,
        message: data.message,
        inserted: data.inserted,
        errors: data.errors
      });
      
      // Clear the textarea on success
      setCsvData('');
      
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Failed to import data'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Complete ETF Data Import
        </CardTitle>
        <CardDescription>
          Replace all existing ETF data with new CSV data. This will clear all current records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="csv-data" className="text-sm font-medium mb-2 block">
            CSV Data
          </label>
          <Textarea
            id="csv-data"
            placeholder="Paste your CSV data here (with headers: ticker,provider,manager,exchange,country,currency,underlying,active,fund,strategy,industry)"
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
        </div>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {result.success ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
              {result.message}
              {result.inserted !== undefined && result.errors !== undefined && (
                <div className="mt-2 text-sm">
                  <div>Inserted: {result.inserted} records</div>
                  <div>Errors: {result.errors} records</div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleImport}
            disabled={loading || !csvData.trim()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {loading ? 'Importing...' : 'Replace All ETF Data'}
          </Button>
          {csvData && (
            <Button
              variant="outline"
              onClick={() => {
                setCsvData('');
                setResult(null);
              }}
            >
              Clear
            </Button>
          )}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> This action will permanently delete all existing ETF data and replace it with the new data.
            Make sure you have a backup if needed.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};