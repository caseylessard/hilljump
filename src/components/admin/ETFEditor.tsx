import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Plus } from "lucide-react";

export const ETFEditor = () => {
  const { toast } = useToast();
  const [searchTicker, setSearchTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<"search" | "add" | "edit">("search");
  
  // ETF form data
  const [formData, setFormData] = useState({
    ticker: "",
    name: "",
    exchange: "",
    category: "",
    yield_ttm: "",
    total_return_1y: "",
    avg_volume: "",
    expense_ratio: "",
    volatility_1y: "",
    max_drawdown_1y: "",
    aum: "",
    manager: "",
    strategy_label: "",
    country: "US",
    currency: "USD",
    summary: "",
    active: true
  });

  const searchETF = async () => {
    if (!searchTicker.trim()) {
      toast({ title: "Enter ticker", description: "Please enter a ticker to search" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("etfs")
        .select("*")
        .eq("ticker", searchTicker.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          ticker: data.ticker,
          name: data.name || "",
          exchange: data.exchange || "",
          category: data.category || "",
          yield_ttm: data.yield_ttm?.toString() || "",
          total_return_1y: data.total_return_1y?.toString() || "",
          avg_volume: data.avg_volume?.toString() || "",
          expense_ratio: data.expense_ratio?.toString() || "",
          volatility_1y: data.volatility_1y?.toString() || "",
          max_drawdown_1y: data.max_drawdown_1y?.toString() || "",
          aum: data.aum?.toString() || "",
          manager: data.manager || "",
          strategy_label: data.strategy_label || "",
          country: data.country || "US",
          currency: data.currency || "USD",
          summary: data.summary || "",
          active: data.active ?? true
        });
        setEditMode("edit");
        toast({ title: "ETF found", description: `Loaded ${data.ticker} for editing` });
      } else {
        toast({ title: "ETF not found", description: `No ETF found with ticker ${searchTicker}` });
      }
    } catch (error: any) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveETF = async () => {
    setSaving(true);
    try {
      const etfData = {
        ticker: formData.ticker.toUpperCase(),
        name: formData.name,
        exchange: formData.exchange,
        category: formData.category || null,
        yield_ttm: formData.yield_ttm ? Number(formData.yield_ttm) : null,
        total_return_1y: formData.total_return_1y ? Number(formData.total_return_1y) : null,
        avg_volume: formData.avg_volume ? Number(formData.avg_volume) : null,
        expense_ratio: formData.expense_ratio ? Number(formData.expense_ratio) : 0.01,
        volatility_1y: formData.volatility_1y ? Number(formData.volatility_1y) : 15,
        max_drawdown_1y: formData.max_drawdown_1y ? Number(formData.max_drawdown_1y) : -10,
        aum: formData.aum ? Number(formData.aum) : null,
        manager: formData.manager || null,
        strategy_label: formData.strategy_label || null,
        country: formData.country,
        currency: formData.currency,
        summary: formData.summary || null,
        active: formData.active
      };

      const { error } = await supabase
        .from("etfs")
        .upsert(etfData);

      if (error) throw error;

      toast({ 
        title: editMode === "edit" ? "ETF updated" : "ETF added", 
        description: `${formData.ticker} saved successfully` 
      });
      
      // Reset form
      setFormData({
        ticker: "",
        name: "",
        exchange: "",
        category: "",
        yield_ttm: "",
        total_return_1y: "",
        avg_volume: "",
        expense_ratio: "",
        volatility_1y: "",
        max_drawdown_1y: "",
        aum: "",
        manager: "",
        strategy_label: "",
        country: "US",
        currency: "USD",
        summary: "",
        active: true
      });
      setEditMode("search");
      setSearchTicker("");
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startAddMode = () => {
    setFormData({
      ticker: "",
      name: "",
      exchange: "",
      category: "",
      yield_ttm: "",
      total_return_1y: "",
      avg_volume: "",
      expense_ratio: "",
      volatility_1y: "",
      max_drawdown_1y: "",
      aum: "",
      manager: "",
      strategy_label: "",
      country: "US",
      currency: "USD",
      summary: "",
      active: true
    });
    setEditMode("add");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {editMode === "search" && <Search className="h-5 w-5" />}
          {editMode === "add" && <Plus className="h-5 w-5" />}
          {editMode === "edit" && "✏️"}
          
          {editMode === "search" && "ETF Management"}
          {editMode === "add" && "Add New ETF"}
          {editMode === "edit" && `Edit ${formData.ticker}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editMode === "search" && (
          <div className="flex gap-2">
            <Input
              placeholder="Enter ticker to search (e.g., AAPL)"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
              className="flex-1"
            />
            <Button onClick={searchETF} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button onClick={startAddMode} variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {(editMode === "add" || editMode === "edit") && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ticker</label>
                <Input
                  value={formData.ticker}
                  onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  disabled={editMode === "edit"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Apple Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Exchange</label>
                <Input
                  value={formData.exchange}
                  onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                  placeholder="NASDAQ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Yield TTM (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.yield_ttm}
                  onChange={(e) => setFormData({ ...formData, yield_ttm: e.target.value })}
                  placeholder="2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Return 1Y (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_return_1y}
                  onChange={(e) => setFormData({ ...formData, total_return_1y: e.target.value })}
                  placeholder="15.2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expense Ratio (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.expense_ratio}
                  onChange={(e) => setFormData({ ...formData, expense_ratio: e.target.value })}
                  placeholder="0.75"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AUM</label>
                <Input
                  type="number"
                  value={formData.aum}
                  onChange={(e) => setFormData({ ...formData, aum: e.target.value })}
                  placeholder="1000000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Currency</label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Summary</label>
              <Textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Brief description of the ETF..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveETF} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save ETF"}
              </Button>
              <Button variant="outline" onClick={() => { setEditMode("search"); setSearchTicker(""); }}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};