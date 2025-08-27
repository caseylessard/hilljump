import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Calendar } from "lucide-react";

export const DistributionEditor = () => {
  const { toast } = useToast();
  const [ticker, setTicker] = useState("");
  const [amount, setAmount] = useState("");
  const [exDate, setExDate] = useState("");
  const [payDate, setPayDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  const addDistribution = async () => {
    if (!ticker.trim() || !amount || !exDate) {
      toast({ title: "Missing fields", description: "Ticker, amount, and ex-date are required" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("dividends")
        .insert({
          ticker: ticker.trim().toUpperCase(),
          amount: Number(amount),
          ex_date: exDate,
          pay_date: payDate || null,
          cash_currency: currency
        });

      if (error) throw error;

      toast({ 
        title: "Distribution added", 
        description: `Added ${currency} ${amount} distribution for ${ticker.toUpperCase()}` 
      });

      // Reset form
      setTicker("");
      setAmount("");
      setExDate("");
      setPayDate("");
      setCurrency("USD");
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Add Distribution Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ticker</label>
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.25"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ex-Dividend Date</label>
            <Input
              type="date"
              value={exDate}
              onChange={(e) => setExDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pay Date (Optional)</label>
            <Input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="USD">USD</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
        </div>

        <Button onClick={addDistribution} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Add Distribution
        </Button>
      </CardContent>
    </Card>
  );
};