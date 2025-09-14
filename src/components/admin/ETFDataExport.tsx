import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Table } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ETFDataExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const exportETFData = async () => {
    setIsExporting(true);
    try {
      const { data: etfs, error } = await supabase
        .from('etfs')
        .select('*')
        .order('ticker');

      if (error) throw error;

      if (!etfs || etfs.length === 0) {
        toast.error("No ETF data found to export");
        return;
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === 'csv') {
        // Convert to CSV
        const headers = Object.keys(etfs[0]).join(',');
        const rows = etfs.map(etf => 
          Object.values(etf).map(value => 
            typeof value === 'string' && value.includes(',') 
              ? `"${value.replace(/"/g, '""')}"` 
              : value
          ).join(',')
        );
        content = [headers, ...rows].join('\n');
        filename = `etf_data_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        // Convert to JSON
        content = JSON.stringify(etfs, null, 2);
        filename = `etf_data_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      // Create and trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`ETF data exported as ${exportFormat.toUpperCase()} (${etfs.length} records)`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export ETF data");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export ETF Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium">Export Format</label>
            <Select value={exportFormat} onValueChange={(value: 'csv' | 'json') => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    CSV (Spreadsheet)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    JSON (Raw Data)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={exportETFData} 
            disabled={isExporting}
            className="mt-6"
          >
            {isExporting ? (
              "Exporting..."
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Export all ETF data from the database for inspection and analysis. 
          Choose CSV for spreadsheet applications or JSON for raw data inspection.
        </p>
      </CardContent>
    </Card>
  );
};