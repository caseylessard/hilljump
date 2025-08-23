import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Dividend {
  id: string;
  ticker: string;
  ex_date: string;
  amount: number;
  cash_currency: string;
  cadence: string | null;
  created_at: string;
}

export const DividendDataViewer = () => {
  const [searchTicker, setSearchTicker] = useState('');
  const [limit, setLimit] = useState(50);

  const { data: dividends = [], isLoading, refetch } = useQuery({
    queryKey: ['dividends', searchTicker, limit],
    queryFn: async () => {
      let query = supabase
        .from('dividends')
        .select('*')
        .order('ex_date', { ascending: false })
        .limit(limit);

      if (searchTicker) {
        query = query.ilike('ticker', `%${searchTicker}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Dividend[];
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['dividend-stats'],
    queryFn: async () => {
      // Get total count first
      const { count: totalCount } = await supabase
        .from('dividends')
        .select('*', { count: 'exact', head: true });

      // Get sample data for stats (no need to load all records for stats)
      const { data, error } = await supabase
        .from('dividends')
        .select('ticker, cadence, amount')
        .limit(5000); // Increased sample size for better stats
      
      if (error) throw error;

      const tickers = new Set(data?.map(d => d.ticker) || []);
      const totalAmount = data?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const cadences = data?.reduce((acc: Record<string, number>, d) => {
        const cadence = d.cadence || 'unknown';
        acc[cadence] = (acc[cadence] || 0) + 1;
        return acc;
      }, {}) || {};

      return {
        totalRecords: totalCount || 0,
        uniqueTickers: tickers.size,
        totalAmount: totalAmount.toFixed(2),
        cadences
      };
    }
  });

  const getCadenceBadge = (cadence: string | null) => {
    if (!cadence) return <Badge variant="secondary">Unknown</Badge>;
    
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      weekly: "default",
      monthly: "secondary",
      quarterly: "outline",
      annually: "outline"
    };

    return <Badge variant={variants[cadence] || "outline"}>{cadence}</Badge>;
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Dividend Data Viewer
        </CardTitle>
        <CardDescription>
          View and search imported dividend distribution data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.totalRecords}</div>
                <div className="text-sm text-muted-foreground">Total Records</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.uniqueTickers}</div>
                <div className="text-sm text-muted-foreground">Unique Tickers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">${stats.totalAmount}</div>
                <div className="text-sm text-muted-foreground">Total Dividends</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium">Cadences</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {Object.entries(stats.cadences).map(([cadence, count]) => (
                    <div key={cadence} className="flex justify-between">
                      <span>{cadence}:</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Controls */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ticker..."
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <Input
            type="number"
            placeholder="Limit"
            value={limit}
            onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 50))}
            className="w-32"
            min="1"
            max="10000"
          />
          <Button onClick={() => refetch()}>Refresh</Button>
        </div>

        {/* Data Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Ex Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Imported</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading dividends...
                  </TableCell>
                </TableRow>
              ) : dividends.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No dividends found. Try importing some data first.
                  </TableCell>
                </TableRow>
              ) : (
                dividends.map((dividend) => (
                  <TableRow key={dividend.id}>
                    <TableCell className="font-mono font-medium">
                      {dividend.ticker}
                    </TableCell>
                    <TableCell>
                      {new Date(dividend.ex_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${dividend.amount.toFixed(3)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{dividend.cash_currency}</Badge>
                    </TableCell>
                    <TableCell>
                      {getCadenceBadge(dividend.cadence)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(dividend.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Sample Data Format */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expected CSV Format</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <div className="text-muted-foreground mb-2">Headers:</div>
              <div>ex_date,amount,ticker,currency,cadence</div>
              <div className="text-muted-foreground mt-4 mb-2">Sample data:</div>
              <div>2025-03-03 05:00:00,0.241,AAPW,USD,weekly</div>
              <div>2024-07-26 04:00:00,1.48,AIPI,USD,monthly</div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};