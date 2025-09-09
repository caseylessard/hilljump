import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Plus, ChevronLeft, ChevronRight, Save, SkipForward } from "lucide-react";

export const ETFEditor = () => {
  const { toast } = useToast();
  const [searchTicker, setSearchTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<"search" | "add" | "edit">("search");
  const [allETFs, setAllETFs] = useState<any[]>([]);
  const [currentETFIndex, setCurrentETFIndex] = useState(0);
  const [loadingETFs, setLoadingETFs] = useState(false);
  
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
    underlying: "",
    fund: "",
    strategy: "",
    industry: "",
    provider_group: "",
    distribution_frequency: "",
    data_source: "",
    twelve_symbol: "",
    eodhd_symbol: "",
    polygon_supported: false,
    active: true
  });

  const loadAllETFs = async () => {
    setLoadingETFs(true);
    try {
      const { data, error } = await supabase
        .from("etfs")
        .select("*")
        .order("ticker", { ascending: true });

      if (error) throw error;

      setAllETFs(data || []);
      toast({ title: "ETFs loaded", description: `Loaded ${data?.length || 0} ETFs for editing` });
    } catch (error: any) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
    } finally {
      setLoadingETFs(false);
    }
  };

  const loadETFByIndex = (index: number) => {
    if (index < 0 || index >= allETFs.length) return;
    
    const etf = allETFs[index];
    setFormData({
      ticker: etf.ticker,
      name: etf.name || "",
      exchange: etf.exchange || "",
      category: etf.category || "",
      yield_ttm: etf.yield_ttm?.toString() || "",
      total_return_1y: etf.total_return_1y?.toString() || "",
      avg_volume: etf.avg_volume?.toString() || "",
      expense_ratio: etf.expense_ratio?.toString() || "",
      volatility_1y: etf.volatility_1y?.toString() || "",
      max_drawdown_1y: etf.max_drawdown_1y?.toString() || "",
      aum: etf.aum?.toString() || "",
      manager: etf.manager || "",
      strategy_label: etf.strategy_label || "",
      country: etf.country || "US",
      currency: etf.currency || "USD",
      summary: etf.summary || "",
      underlying: etf.underlying || "",
      fund: etf.fund || "",
      strategy: etf.strategy || "",
      industry: etf.industry || "",
      provider_group: etf.provider_group || "",
      distribution_frequency: etf.distribution_frequency || "",
      data_source: etf.data_source || "",
      twelve_symbol: etf.twelve_symbol || "",
      eodhd_symbol: etf.eodhd_symbol || "",
      polygon_supported: etf.polygon_supported || false,
      active: etf.active ?? true
    });
    setCurrentETFIndex(index);
  };

  const startBulkEdit = async () => {
    await loadAllETFs();
    if (allETFs.length > 0) {
      loadETFByIndex(0);
      setEditMode("edit");
    }
  };

  const navigateETF = (direction: "prev" | "next") => {
    const newIndex = direction === "next" ? currentETFIndex + 1 : currentETFIndex - 1;
    if (newIndex >= 0 && newIndex < allETFs.length) {
      loadETFByIndex(newIndex);
    }
  };

  // Load ETFs on bulk edit mode
  useEffect(() => {
    if (editMode === "edit" && allETFs.length > 0) {
      loadETFByIndex(currentETFIndex);
    }
  }, [allETFs, editMode]);

  const saveAndNext = async () => {
    const saved = await saveETF(true);
    if (saved && currentETFIndex < allETFs.length - 1) {
      navigateETF("next");
    }
  };

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
          underlying: data.underlying || "",
          fund: data.fund || "",
          strategy: data.strategy || "",
          industry: data.industry || "",
          provider_group: data.provider_group || "",
          distribution_frequency: data.distribution_frequency || "",
          data_source: data.data_source || "",
          twelve_symbol: data.twelve_symbol || "",
          eodhd_symbol: data.eodhd_symbol || "",
          polygon_supported: data.polygon_supported || false,
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

  const saveETF = async (skipReset = false) => {
    if (!formData.ticker || !formData.name) {
      toast({ title: "Missing data", description: "Ticker and name are required", variant: "destructive" });
      return false;
    }

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
        underlying: formData.underlying || null,
        fund: formData.fund || null,
        strategy: formData.strategy || null,
        industry: formData.industry || null,
        provider_group: formData.provider_group || null,
        distribution_frequency: formData.distribution_frequency || null,
        data_source: formData.data_source || null,
        twelve_symbol: formData.twelve_symbol || null,
        eodhd_symbol: formData.eodhd_symbol || null,
        polygon_supported: formData.polygon_supported,
        active: formData.active
      };

      const { error } = await supabase
        .from("etfs")
        .upsert(etfData, { onConflict: 'ticker' });

      if (error) throw error;

      toast({ 
        title: editMode === "edit" ? "ETF updated" : "ETF added", 
        description: `${formData.ticker} saved successfully` 
      });
      
      if (!skipReset) {
        // Reset form only if not in bulk edit mode
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
          underlying: "",
          fund: "",
          strategy: "",
          industry: "",
          provider_group: "",
          distribution_frequency: "",
          data_source: "",
          twelve_symbol: "",
          eodhd_symbol: "",
          polygon_supported: false,
          active: true
        });
        setEditMode("search");
        setSearchTicker("");
      }
      return true;
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return false;
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
      underlying: "",
      fund: "",
      strategy: "",
      industry: "",
      provider_group: "",
      distribution_frequency: "",
      data_source: "",
      twelve_symbol: "",
      eodhd_symbol: "",
      polygon_supported: false,
      active: true
    });
    setEditMode("add");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editMode === "search" && <Search className="h-5 w-5" />}
            {editMode === "add" && <Plus className="h-5 w-5" />}
            {editMode === "edit" && "✏️"}
            
            {editMode === "search" && "Search & Edit ETFs"}
            {editMode === "add" && "Add New ETF"}
            {editMode === "edit" && `Edit ${formData.ticker}`}
          </div>
          
          {editMode === "search" && (
            <Button onClick={startAddMode} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add New
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editMode === "search" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Search for an existing ETF to edit its metadata, create a new one, or start bulk editing all ETFs.
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter ticker to search (e.g., AAPL, MSTY, TSLY)"
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && searchETF()}
              />
              <Button onClick={searchETF} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={startBulkEdit} disabled={loadingETFs} variant="secondary">
                {loadingETFs ? <Loader2 className="h-4 w-4 animate-spin" /> : "📝"}
                Start Bulk Editing
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Load all ETFs alphabetically for quick editing
              </span>
            </div>
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
                <label className="block text-sm font-medium mb-1">Underlying Stock</label>
                <Input
                  value={formData.underlying}
                  onChange={(e) => setFormData({ ...formData, underlying: e.target.value })}
                  placeholder="AAPL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fund</label>
                <Input
                  value={formData.fund}
                  onChange={(e) => setFormData({ ...formData, fund: e.target.value })}
                  placeholder="YieldMax AAPL Option Income Strategy ETF"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Strategy</label>
                <Input
                  value={formData.strategy}
                  onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                  placeholder="Covered Call"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Industry</label>
                <Input
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Provider Group</label>
                <Input
                  value={formData.provider_group}
                  onChange={(e) => setFormData({ ...formData, provider_group: e.target.value })}
                  placeholder="YieldMax"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Distribution Frequency</label>
                <Select value={formData.distribution_frequency} onValueChange={(v) => setFormData({ ...formData, distribution_frequency: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                    <SelectItem value="Annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
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
                <label className="block text-sm font-medium mb-1">Manager</label>
                <Input
                  value={formData.manager}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  placeholder="BlackRock"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Strategy Label</label>
                <Input
                  value={formData.strategy_label}
                  onChange={(e) => setFormData({ ...formData, strategy_label: e.target.value })}
                  placeholder="Covered Call Strategy"
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
              <div>
                <label className="block text-sm font-medium mb-1">Data Source</label>
                <Input
                  value={formData.data_source}
                  onChange={(e) => setFormData({ ...formData, data_source: e.target.value })}
                  placeholder="polygon"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">TwelveData Symbol</label>
                <Input
                  value={formData.twelve_symbol}
                  onChange={(e) => setFormData({ ...formData, twelve_symbol: e.target.value })}
                  placeholder="AAPL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">EODHD Symbol</label>
                <Input
                  value={formData.eodhd_symbol}
                  onChange={(e) => setFormData({ ...formData, eodhd_symbol: e.target.value })}
                  placeholder="AAPL.US"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="polygon_supported"
                  checked={formData.polygon_supported}
                  onChange={(e) => setFormData({ ...formData, polygon_supported: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="polygon_supported" className="text-sm font-medium">
                  Polygon Supported
                </label>
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

            {allETFs.length > 0 && editMode === "edit" && (
              <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateETF("prev")}
                    disabled={currentETFIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentETFIndex + 1} of {allETFs.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateETF("next")}
                    disabled={currentETFIndex === allETFs.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-medium">
                  Editing: {formData.ticker}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {allETFs.length > 0 && editMode === "edit" ? (
                <>
                  <Button onClick={saveAndNext} disabled={saving || currentETFIndex === allETFs.length - 1}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save & Next
                  </Button>
                  <Button onClick={() => saveETF()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => navigateETF("next")} disabled={currentETFIndex === allETFs.length - 1}>
                    <SkipForward className="h-4 w-4" />
                    Skip
                  </Button>
                </>
              ) : (
                <Button onClick={() => saveETF()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save ETF"}
                </Button>
              )}
              <Button variant="outline" onClick={() => { setEditMode("search"); setSearchTicker(""); setAllETFs([]); }}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};