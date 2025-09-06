import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Check, Plus, Database } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { resetCache } from '@/lib/cacheUtils';

export const ManualDividendEntry = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ticker: '',
    amount: '',
    exDate: '',
    payDate: '',
    currency: 'USD'
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.ticker || !formData.amount || !formData.exDate) {
      toast({
        title: "Missing Required Fields",
        description: "Ticker, amount, and ex-date are required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('dividends')
        .insert({
          ticker: formData.ticker.toUpperCase(),
          amount: parseFloat(formData.amount),
          ex_date: formData.exDate,
          pay_date: formData.payDate || null,
          cash_currency: formData.currency
        });

      if (error) {
        if (error.code === '23505') { // Duplicate key violation
          toast({
            title: "Duplicate Entry",
            description: "This dividend entry already exists",
            variant: "destructive"
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Dividend Added",
          description: `Successfully added ${formData.ticker} dividend for ${formData.exDate}`,
        });
        
        // Reset form
        setFormData({
          ticker: '',
          amount: '',
          exDate: '',
          payDate: '',
          currency: 'USD'
        });
        
        // Clear cache
        resetCache();
      }
    } catch (error: any) {
      toast({
        title: "Error Adding Dividend",
        description: error.message || 'Failed to add dividend',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const quickFillMSTY = () => {
    setFormData({
      ticker: 'MSTY',
      amount: '1.25', // Approximate based on recent history
      exDate: '2025-08-29',
      payDate: '2025-08-30',
      currency: 'USD'
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Manual Dividend Entry
        </CardTitle>
        <CardDescription>
          Quickly add missing dividend distributions when automated systems lag behind
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ticker">Ticker Symbol *</Label>
              <Input
                id="ticker"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                placeholder="e.g., MSTY"
                required
              />
            </div>
            <div>
              <Label htmlFor="amount">Distribution Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.0001"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="e.g., 1.25"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exDate">Ex-Dividend Date *</Label>
              <Input
                id="exDate"
                type="date"
                value={formData.exDate}
                onChange={(e) => setFormData({ ...formData, exDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="payDate">Pay Date (Optional)</Label>
              <Input
                id="payDate"
                type="date"
                value={formData.payDate}
                onChange={(e) => setFormData({ ...formData, payDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Quick Fix:</strong> Missing MSTY 8/29 distribution?{' '}
              <button
                type="button"
                onClick={quickFillMSTY}
                className="text-primary underline hover:no-underline"
              >
                Click to auto-fill
              </button>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {loading ? 'Adding...' : 'Add Dividend'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({
                ticker: '',
                amount: '',
                exDate: '',
                payDate: '',
                currency: 'USD'
              })}
            >
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};