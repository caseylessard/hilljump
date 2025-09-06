import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Zap } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { QuickPriceTest } from "@/components/QuickPriceTest";
import HistoricalPriceTest from "@/components/HistoricalPriceTest";
import PriceSystemTest from "@/components/PriceSystemTest";
import MstyEodhdTest from "@/components/admin/MstyEodhdTest";
import ComprehensiveEodhdTest from "@/components/admin/ComprehensiveEodhdTest";
import { DividendSystemTest } from "@/components/admin/DividendSystemTest";
import { ETFEditor } from "@/components/admin/ETFEditor";
import { DistributionEditor } from "@/components/admin/DistributionEditor";
import DailyAlertsTestSuite from "@/components/admin/DailyAlertsTestSuite";
import { RefreshDividendData } from "@/components/RefreshDividendData";
import { ManualDividendEntry } from "@/components/admin/ManualDividendEntry";
interface Position { id: string; user_id: string; ticker: string; shares: number; created_at: string; }

const Profile = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState<number>(0);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [approved, setApproved] = useState<boolean>(false);
  const [country, setCountry] = useState<'US' | 'CA'>('CA');
  const [weights, setWeights] = useState({ r: 15, y: 25, k: 20, d: 20, t4: 8, t52: 2, h: 6 });
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const { isAdmin, loading: adminLoading } = useAdmin();

  // SEO
  useEffect(() => {
    document.title = "HillJump — Profile & Portfolio";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => { const m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); return m as HTMLMetaElement; })();
    meta.setAttribute('content', 'Manage your portfolio tickers and shares. Track estimated current value.');
  }, []);


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("portfolio_positions").select("*").eq("user_id", userId).order("created_at");
      if (error) {
        toast({ title: "Failed to load portfolio", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      setPositions(data as Position[]);
      setLoading(false);
    })();
  }, [userId, toast]);

  useEffect(() => {
    const uniq = Array.from(new Set(positions.map(p => p.ticker)));
    if (uniq.length === 0) { setPrices({}); return; }
    supabase.functions.invoke("quotes", { body: { tickers: uniq } }).then(({ data, error }) => {
      if (error) {
        toast({ title: "Price fetch failed", description: error.message, variant: "destructive" });
        return;
      }
      setPrices((data as any)?.prices ?? {});
    });
  }, [positions, toast]);

  // Load user profile (username, names, country, approved)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, first_name, last_name, country, approved')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        setUsername((data as any).username ?? '');
        setFirstName((data as any).first_name ?? '');
        setLastName((data as any).last_name ?? '');
        setCountry(((data as any).country as 'US' | 'CA') ?? 'CA');
        setApproved(Boolean((data as any).approved));
      } else {
        setUsername('');
        setFirstName('');
        setLastName('');
        setCountry('CA');
        setApproved(false);
      }
    })();
  }, [userId]);

  // Load ranking preferences
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('return_weight, yield_weight, risk_weight, dividend_stability, period_4w_weight, period_52w_weight, home_country_bias')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        setWeights({
          r: Number((data as any).return_weight) || 15,
          y: Number((data as any).yield_weight) || 25,
          k: Number((data as any).risk_weight) || 20,
          d: Number((data as any).dividend_stability) || 20,
          t4: Number((data as any).period_4w_weight) || 8,
          t52: Number((data as any).period_52w_weight) || 2,
          h: Number((data as any).home_country_bias) || 6,
        });
      }
    })();
  }, [userId]);

  // Load subscription status
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('subscribers')
        .select('subscribed, subscription_tier')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) {
        setSubscribed(Boolean((data as any).subscribed));
        setSubscriptionTier(((data as any).subscription_tier as string) || null);
      } else {
        setSubscribed(false);
        setSubscriptionTier(null);
      }
    })();
  }, [userId]);

  const total = useMemo(() => positions.reduce((sum, p) => sum + (prices[p.ticker] ?? 0) * (Number(p.shares) || 0), 0), [positions, prices]);

  const addOrUpdate = async () => {
    if (!userId) return;
    
    // Sanitize ticker input
    const sanitizedTicker = ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').substring(0, 10);
    if (!sanitizedTicker || sanitizedTicker.length < 1) {
      toast({ title: "Invalid ticker", description: "Please enter a valid ticker symbol" });
      return;
    }

    if (shares <= 0 || shares > 1000000 || !isFinite(shares)) {
      toast({ title: "Invalid shares", description: "Please enter a valid number of shares (0.01 - 1,000,000)" });
      return;
    }

    const { error } = await supabase.from("portfolio_positions").upsert({ 
      user_id: userId, 
      ticker: sanitizedTicker, 
      shares 
    }, { onConflict: "user_id,ticker" });
    
    if (error) { 
      toast({ title: "Save failed", description: error.message, variant: "destructive" }); 
      return; 
    }
    
    setTicker(""); 
    setShares(0);
    const { data } = await supabase.from("portfolio_positions").select("*").eq("user_id", userId).order("created_at");
    setPositions((data as Position[]) || []);
    toast({ title: "Position updated successfully" });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("portfolio_positions").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setPositions(prev => prev.filter(p => p.id !== id));
  };

  const savePreferences = async () => {
    // Ensure we have a fresh, valid session (important on mobile/in-app browsers)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast({ title: 'Not signed in', description: 'Please sign in again to save your profile.', variant: 'destructive' });
      window.location.href = '/auth';
      return;
    }
    const uid = session.user.id;
    // Sanitize all user inputs
    const desiredUsername = (username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
    const sanitizedFirstName = (firstName || '').replace(/[^a-zA-Z\s'-]/g, '').trim().slice(0, 50);
    const sanitizedLastName = (lastName || '').replace(/[^a-zA-Z\s'-]/g, '').trim().slice(0, 50);
    
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: uid, 
        username: desiredUsername || null, 
        first_name: sanitizedFirstName || null, 
        last_name: sanitizedLastName || null, 
        country 
      });
    if (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('idx_profiles_username_unique') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        toast({ title: 'Username taken', description: 'Please choose a different username.', variant: 'destructive' });
      } else {
        toast({ title: 'Save failed', description: msg, variant: 'destructive' });
      }
      return;
    }
    setUsername(desiredUsername);
    toast({ title: 'Preferences saved', description: `${firstName ? firstName + ' • ' : ''}${country === 'CA' ? 'Canada 🇨🇦' : 'United States 🇺🇸'}` });
  };

  const saveRanking = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        return_weight: weights.r,
        yield_weight: weights.y,
        risk_weight: weights.k,
        dividend_stability: weights.d,
        period_4w_weight: weights.t4,
        period_52w_weight: weights.t52,
        home_country_bias: weights.h,
      });
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Ranking preferences saved' });
  };

  const applyPreset = async (presetName: 'balanced' | 'income_first' | 'total_return') => {
    if (!userId) return;
    
    // Map presets to the simplified weights structure used by the old UI
    const presetMappings = {
      balanced: { r: 15, y: 25, k: 20, d: 20, t4: 8, t52: 2, h: 6 },
      income_first: { r: 5, y: 35, k: 20, d: 25, t4: 3, t52: 2, h: 6 },
      total_return: { r: 30, y: 15, k: 20, d: 10, t4: 10, t52: 10, h: 6 }
    };
    
    const newWeights = presetMappings[presetName];
    setWeights(newWeights);
    
    // Save immediately to database
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        return_weight: newWeights.r,
        yield_weight: newWeights.y,
        risk_weight: newWeights.k,
        dividend_stability: newWeights.d,
        period_4w_weight: newWeights.t4,
        period_52w_weight: newWeights.t52,
        home_country_bias: newWeights.h,
      });
      
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    
    const presetNames = {
      balanced: 'Balanced Income',
      income_first: 'Income-First',
      total_return: 'Total-Return Tilt'
    };
    
    toast({ title: 'Preset applied', description: `${presetNames[presetName]} preferences saved successfully.` });
  };

  const refreshSubscription = async () => {
    const { data, error } = await supabase.functions.invoke('check-subscription');
    if (error) {
      toast({ title: 'Refresh failed', description: error.message, variant: 'destructive' });
      return;
    }
    const d: any = data || {};
    setSubscribed(Boolean(d.subscribed));
    setSubscriptionTier(d.subscription_tier || null);
    toast({ title: 'Subscription status updated' });
  };

  const upgrade = async (tier: 'subscriber' | 'premium') => {
    const { data, error } = await supabase.functions.invoke('create-checkout', { body: { tier } });
    if (error || !(data as any)?.url) {
      toast({ title: 'Checkout failed', description: error?.message || 'Unable to start checkout', variant: 'destructive' });
      return;
    }
    window.open((data as any).url, '_blank');
  };

  const manageSubscription = async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    if (error || !(data as any)?.url) {
      toast({ title: 'Portal error', description: error?.message || 'Unable to open portal', variant: 'destructive' });
      return;
    }
    window.open((data as any).url, '_blank');
  };

  const resetPassword = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) { toast({ title: 'Not signed in', description: 'Please sign in first.', variant: 'destructive' }); return; }
      const redirectUrl = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
      if (error) throw error;
      toast({ title: 'Password reset sent', description: `Check ${email} for a reset link.` });
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const testSampleStocks = async () => {
    console.log('Testing WebSocket stream with sample stocks...');
    
    // Test stocks: mix of US and Canadian
    const testTickers = [
      'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', // US stocks
      'SHOP.TO', 'RY.TO', 'TD.TO', 'CNR.TO', 'WEED.TO' // Canadian stocks
    ];
    
    const results: any[] = [];
    
    // Create WebSocket connection
    const wsUrl = `wss://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/etf-stream`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected for testing');
      ws.send(JSON.stringify({ type: 'test', tickers: testTickers }));
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Test message received:', message);
      
      if (message.type === 'data') {
        results.push({
          ticker: message.ticker,
          country: message.ticker.includes('.TO') ? 'CA' : 'US',
          data: message.data,
          timestamp: new Date().toISOString()
        });
        setTestResults([...results]);
      } else if (message.type === 'complete') {
        ws.close();
        console.log('Test complete:', results);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket test error:', error);
    };
  };

  const exportEtfs = async () => {
    try {
      const columns = [
        'ticker','name','exchange','category','yield_ttm','total_return_1y','avg_volume','expense_ratio','volatility_1y','max_drawdown_1y','aum','manager','strategy_label','logo_key','country','summary'
      ];
      const { data, error } = await supabase
        .from('etfs')
        .select(columns.join(','))
        .order('ticker');
      if (error) throw error;
      const esc = (v: any) => {
        if (v == null) return '';
        const s = String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const csv = [columns.join(',')]
        .concat((data || []).map((row: any) => columns.map((c) => esc((row as any)[c])).join(',')))
        .join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'etfs_export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'CSV downloaded', description: `${(data || []).length} ETFs exported` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const importEtfsFromFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const { data, error } = await supabase.functions.invoke('import-etfs', { body: { csv: text } });
      if (error) throw error;
      const res: any = data || {};
      toast({ title: 'Import complete', description: `Inserted ${res.inserted || 0}, updated ${res.updated || 0}` });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };
  return (
    <div>
      <Navigation />

      <main className="container py-4 px-4 sm:py-8 sm:px-6 grid gap-4 sm:gap-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
        
        {!userId ? (
          <Card className="p-4 sm:p-6">
            <p className="mb-4">Please sign in to manage your profile and subscription.</p>
            <Button asChild><a href="/auth">Go to Auth</a></Button>
          </Card>
        ) : (
          <>
            {/* User Info - Always at top and persistent */}
            <Card className="p-4 grid gap-3">
              <h2 className="text-lg font-semibold">User Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-1">
                  <label className="block text-sm mb-1">Username</label>
                  <Input
                    placeholder="e.g., caseylessard"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm mb-1">First name</label>
                  <Input placeholder="e.g., Alex" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm mb-1">Last name</label>
                  <Input placeholder="e.g., Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm mb-1">Country</label>
                  <Select value={country} onValueChange={(v) => setCountry(v as 'US' | 'CA')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Country" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CA">Canada 🇨🇦</SelectItem>
                      <SelectItem value="US">United States 🇺🇸</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 sm:col-span-1 lg:col-span-1">
                  <Button onClick={savePreferences} className="w-full">Save</Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Status: {approved ? (
                  <>
                    <Badge variant="secondary">Approved</Badge>
                    {isAdmin && <Badge variant="outline" className="ml-2">Admin</Badge>}
                  </>
                ) : (
                  <Badge variant="outline">Pending approval</Badge>
                )}
              </div>
            </Card>

            {/* Subscription Section */}
            <Card className="p-4 grid gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Subscription</div>
                  <div className="text-sm text-muted-foreground">Current: {subscribed ? (subscriptionTier ? subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1) : 'Active') : 'Free'}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={refreshSubscription} size="sm">Refresh</Button>
                  <Button onClick={manageSubscription} size="sm">Manage</Button>
                  <Button variant="outline" onClick={resetPassword} size="sm">Reset Password</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button onClick={() => upgrade('subscriber')}>Upgrade to Subscriber — $9/mo</Button>
                <Button variant="secondary" onClick={() => upgrade('premium')}>Upgrade to Premium — $29/mo</Button>
              </div>
            </Card>

            {/* Portfolio Section - Only for subscribers/admins */}
            {(subscribed || isAdmin) && (
              <>
                <Card className="p-4 grid gap-3">
                  <h2 className="text-lg font-semibold">Portfolio Management</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input placeholder="Ticker (e.g., AAPL)" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
                    <Input type="number" placeholder="Shares" value={shares} onChange={(e) => setShares(Number(e.target.value))} />
                    <Button onClick={addOrUpdate}>Add / Update</Button>
                  </div>
                </Card>

                <Card className="p-4 overflow-x-auto">
                  <h3 className="text-md font-semibold mb-3">Portfolio Positions</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
                      ) : positions.length === 0 ? (
                        <TableRow><TableCell colSpan={5}>No positions yet.</TableCell></TableRow>
                      ) : (
                        positions.map((p) => {
                          const price = (prices[p.ticker] ?? 0) as number;
                          const value = price * (Number(p.shares) || 0);
                          return (
                            <TableRow key={p.id}>
                              <TableCell>{p.ticker}</TableCell>
                              <TableCell className="text-right">{Number(p.shares)}</TableCell>
                              <TableCell className="text-right">{price ? `$${price.toFixed(2)}` : "-"}</TableCell>
                              <TableCell className="text-right">{price ? `$${value.toFixed(2)}` : "-"}</TableCell>
                              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => remove(p.id)}>Delete</Button></TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  <div className="mt-3 text-right font-semibold">Total: ${total.toFixed(2)}</div>
                </Card>
              </>
            )}

            {/* Admin Section - Dividend Management */}
            {isAdmin && !adminLoading && (
              <Card className="p-4">
                <h2 className="text-lg font-semibold mb-4">Admin - Dividend Data Management</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <RefreshDividendData />
                  <ManualDividendEntry />
                </div>
              </Card>
            )}

            {/* Admin Section - ETF Management */}
            {isAdmin && !adminLoading && (
              <>
                <Card className="p-4">
                  <h2 className="text-lg font-semibold mb-4">Admin - Daily Alerts System</h2>
                  <div className="space-y-4">
                    <DailyAlertsTestSuite />
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="text-lg font-semibold mb-4">Admin - ETF Management</h2>
                  <div className="space-y-4">
                    <ETFEditor />
                    <DistributionEditor />
                    
                    {/* Fetch Latest Dividends Function */}
                    <Card className="p-4">
                      <h3 className="font-semibold mb-2">Fetch Latest Dividends</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Fetch latest dividend data from Polygon API (prevents duplicates)
                      </p>
                      <Button 
                        onClick={async () => {
                          const { data, error } = await supabase.functions.invoke('fetch-latest-dividends');
                          if (error) {
                            toast({ title: "Fetch failed", description: error.message, variant: "destructive" });
                          } else {
                            toast({ title: "Success", description: data.message });
                          }
                        }}
                      >
                        Fetch Latest Dividends
                      </Button>
                    </Card>
                  </div>
                </Card>

                <Card className="p-4 grid gap-3 mt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Export/Import ETFs CSV</div>
                      <div className="text-sm text-muted-foreground">Export all ETFs or import a CSV to update them.</div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={exportEtfs} size="sm">Export CSV</Button>
                      <label className={`cursor-pointer ${importing ? 'pointer-events-none' : ''}`}>
                        <input 
                          type="file" 
                          accept=".csv" 
                          className="hidden" 
                          disabled={importing}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) importEtfsFromFile(file);
                            e.currentTarget.value = '';
                          }} 
                        />
                        <span className={`inline-flex items-center justify-center h-9 px-4 rounded-md border bg-background gap-2 text-sm ${importing ? 'opacity-50' : ''}`}>
                          {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                          Import CSV
                        </span>
                      </label>
                    </div>
                  </div>
                </Card>

                <div className="space-y-6">
                  <h2 className="text-xl sm:text-2xl font-semibold">WebSocket vs Cron Jobs Test</h2>
                  <div className="text-center space-y-2">
                    <p className="text-muted-foreground">Test WebSocket streaming vs traditional cron jobs</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          Current Cron Jobs
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="p-3 border rounded-lg">
                            <div className="font-medium text-sm sm:text-base">dividend-updater-daily</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">Schedule: 0 6 * * * (Daily at 6 AM)</div>
                            <Badge variant="outline" className="mt-1 text-xs">Active</Badge>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <div className="font-medium text-sm sm:text-base">fetch-etf-data-every-5min</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">Schedule: */5 * * * * (Every 5 minutes)</div>
                            <Badge variant="outline" className="mt-1 text-xs">Active</Badge>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs sm:text-sm text-yellow-800">
                            <strong>Recommendation:</strong> The 5-minute cron job can be removed if WebSocket streaming works reliably.
                            Keep the daily dividend updater for scheduled maintenance.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                          WebSocket Test
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <Button onClick={testSampleStocks} className="w-full text-sm sm:text-base">
                            Test 10 Sample Stocks
                          </Button>
                          
                          {testResults.length > 0 && (
                            <ScrollArea className="h-48 sm:h-64">
                              <div className="space-y-2">
                                {testResults.map((result, index) => (
                                  <div key={index} className="p-2 border rounded text-xs sm:text-sm">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <Badge variant={result.country === 'US' ? 'default' : 'secondary'} className="text-xs">
                                          {result.ticker} ({result.country})
                                        </Badge>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          Price: ${result.data.price?.toFixed(2) || 'N/A'}
                                          {result.data.yield && ` | Yield: ${result.data.yield.toFixed(2)}%`}
                                        </div>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(result.timestamp).toLocaleTimeString()}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
              <ComprehensiveEodhdTest />
              <DividendSystemTest />
                    <MstyEodhdTest />
                    <QuickPriceTest />
                    <HistoricalPriceTest />
                    <PriceSystemTest />
                  </div>
                </div>
              </>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground mt-4">Not investment advice.</p>
      </main>
    </div>
  );
};

export default Profile;
