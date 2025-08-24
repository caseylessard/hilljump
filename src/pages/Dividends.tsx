import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getETFs } from '@/lib/db';
import { fetchLatestDistributions, predictNextDistribution } from '@/lib/dividends';
import { useCachedFirstThenLive } from '@/hooks/useCachedFirstThenLive';
import { UserBadge } from '@/components/UserBadge';
import Navigation from '@/components/Navigation';
import { format, isAfter } from 'date-fns';

interface DividendTableRow {
  ticker: string;
  name: string;
  country: string;
  currentPrice?: number;
  yieldTTM?: number;
  lastDistribution?: {
    amount: number;
    date: string;
    currency: string;
  };
  nextDistribution?: {
    amount: number;
    date: string;
    currency: string;
  };
  frequency: string;
  annualAmount?: number;
  payoutRatio?: number;
}

type SortKey = 'ticker' | 'yield' | 'lastDist' | 'nextDist' | 'frequency' | 'annual';
type FilterType = 'all' | 'canada' | 'usa' | 'monthly' | 'quarterly' | 'high-yield';

const Dividends = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortKey, setSortKey] = useState<SortKey>('yield');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Fetch ETFs
  const { data: etfs = [], isLoading } = useQuery({
    queryKey: ['etfs'],
    queryFn: getETFs,
    staleTime: 5 * 60 * 1000,
  });

  // Memoize tickers
  const tickers = useMemo(() => etfs.map(etf => etf.ticker), [etfs]);
  
  // Use cached-first loading
  const { prices: livePrices, distributions } = useCachedFirstThenLive(tickers);

  // Transform data for dividend table
  const dividendData: DividendTableRow[] = useMemo(() => {
    return etfs.map(etf => {
      const price = livePrices[etf.ticker];
      const lastDist = distributions[etf.ticker];
      
      return {
        ticker: etf.ticker,
        name: etf.name,
        country: etf.country || '',
        currentPrice: price?.currentPrice || etf.current_price,
        yieldTTM: etf.yieldTTM || price?.yieldTTM,
        lastDistribution: lastDist ? {
          amount: lastDist.amount,
          date: lastDist.date,
          currency: lastDist.currency || 'USD'
        } : undefined,
        frequency: (etf as any).distribution_frequency || 'Unknown',
        annualAmount: etf.yieldTTM && price?.currentPrice ? 
          (etf.yieldTTM / 100) * price.currentPrice : undefined,
      };
    });
  }, [etfs, livePrices, distributions]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = dividendData.filter(row => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        row.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Category filter
      switch (filter) {
        case 'canada':
          return row.country.toUpperCase() === 'CA' || row.ticker.endsWith('.TO');
        case 'usa':
          return row.country.toUpperCase() === 'US' || (!row.ticker.endsWith('.TO') && !row.ticker.includes('.'));
        case 'monthly':
          return row.frequency.toLowerCase().includes('monthly');
        case 'quarterly':
          return row.frequency.toLowerCase().includes('quarterly');
        case 'high-yield':
          return (row.yieldTTM || 0) >= 6; // 6%+ yield
        case 'all':
        default:
          return true;
      }
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortKey) {
        case 'ticker':
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case 'yield':
          aVal = a.yieldTTM || 0;
          bVal = b.yieldTTM || 0;
          break;
        case 'lastDist':
          aVal = a.lastDistribution ? new Date(a.lastDistribution.date) : new Date(0);
          bVal = b.lastDistribution ? new Date(b.lastDistribution.date) : new Date(0);
          break;
        case 'annual':
          aVal = a.annualAmount || 0;
          bVal = b.annualAmount || 0;
          break;
        default:
          aVal = a.yieldTTM || 0;
          bVal = b.yieldTTM || 0;
      }

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [dividendData, searchTerm, filter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const getFrequencyBadge = (frequency: string) => {
    const freq = frequency.toLowerCase();
    if (freq.includes('monthly')) return <Badge variant="default">Monthly</Badge>;
    if (freq.includes('quarterly')) return <Badge variant="secondary">Quarterly</Badge>;
    if (freq.includes('annual')) return <Badge variant="outline">Annual</Badge>;
    return <Badge variant="outline">{frequency}</Badge>;
  };

  const filterOptions = [
    { value: 'all', label: 'All ETFs' },
    { value: 'canada', label: 'Canadian ETFs' },
    { value: 'usa', label: 'US ETFs' },
    { value: 'monthly', label: 'Monthly Payers' },
    { value: 'quarterly', label: 'Quarterly Payers' },
    { value: 'high-yield', label: 'High Yield (6%+)' }
  ];

  // Stats
  const stats = useMemo(() => {
    const totalETFs = filteredData.length;
    const avgYield = filteredData.reduce((sum, row) => sum + (row.yieldTTM || 0), 0) / totalETFs;
    const monthlyPayers = filteredData.filter(row => row.frequency.toLowerCase().includes('monthly')).length;
    const highYield = filteredData.filter(row => (row.yieldTTM || 0) >= 6).length;
    
    return { totalETFs, avgYield, monthlyPayers, highYield };
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dividend ETFs</h1>
            <p className="text-muted-foreground">
              Comprehensive dividend information for all ETFs
            </p>
          </div>
          <UserBadge />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center p-6">
              <DollarSign className="h-8 w-8 text-muted-foreground mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalETFs}</p>
                <p className="text-xs text-muted-foreground">Total ETFs</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingUp className="h-8 w-8 text-muted-foreground mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.avgYield.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Avg Yield</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Calendar className="h-8 w-8 text-muted-foreground mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.monthlyPayers}</p>
                <p className="text-xs text-muted-foreground">Monthly Payers</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <DollarSign className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.highYield}</p>
                <p className="text-xs text-muted-foreground">High Yield (6%+)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ETFs by ticker or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dividend Table */}
        <Card>
          <Table>
            <TableCaption>
              Dividend information for {filteredData.length} ETFs. Data updated from multiple sources.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('ticker')}>
                    Ticker {getSortIndicator('ticker')}
                  </Button>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('yield')}>
                    Yield (TTM) {getSortIndicator('yield')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('lastDist')}>
                    Last Distribution {getSortIndicator('lastDist')}
                  </Button>
                </TableHead>
                <TableHead>Next Dist. (Est.)</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('annual')}>
                    Annual Amount {getSortIndicator('annual')}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    Loading dividend data...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    No ETFs found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row) => (
                  <TableRow key={row.ticker}>
                    <TableCell className="font-medium">{row.ticker}</TableCell>
                    <TableCell className="max-w-xs truncate" title={row.name}>
                      {row.name}
                    </TableCell>
                    <TableCell>
                      {row.country === 'CA' ? '🇨🇦' : row.country === 'US' ? '🇺🇸' : row.country}
                    </TableCell>
                    <TableCell>
                      {row.yieldTTM ? (
                        <span className={row.yieldTTM >= 6 ? 'text-green-600 font-semibold' : ''}>
                          {row.yieldTTM.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {row.lastDistribution ? (
                        <div className="space-y-1">
                          <div>${row.lastDistribution.amount.toFixed(3)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(row.lastDistribution.date), 'MMM d, yyyy')}
                          </div>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <NextDistributionCell ticker={row.ticker} />
                    </TableCell>
                    <TableCell>
                      {getFrequencyBadge(row.frequency)}
                    </TableCell>
                    <TableCell>
                      {row.annualAmount ? (
                        <span className="font-medium">
                          ${row.annualAmount.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
};

// Component to show estimated next distribution
const NextDistributionCell = ({ ticker }: { ticker: string }) => {
  const { data: nextDividend } = useQuery({
    queryKey: ['nextDividend', ticker],
    queryFn: async () => {
      try {
        return await predictNextDistribution(ticker);
      } catch (error) {
        return null;
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  if (!nextDividend) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="space-y-1">
      <div>${nextDividend.amount?.toFixed(3) || '?'}</div>
      <div className="text-xs text-muted-foreground">
        {nextDividend.date ? 
          format(new Date(nextDividend.date), 'MMM d, yyyy') : 
          'Estimate'}
      </div>
    </div>
  );
};

export default Dividends;