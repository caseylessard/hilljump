import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
interface Position { id: string; user_id: string; ticker: string; shares: number; created_at: string; }

const Profile = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
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
  const [weights, setWeights] = useState({ r: 60, y: 20, k: 20, d: 50 });
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);

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
        .select('return_weight, yield_weight, risk_weight, dividend_stability')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        setWeights({
          r: Number((data as any).return_weight) || 60,
          y: Number((data as any).yield_weight) || 20,
          k: Number((data as any).risk_weight) || 20,
          d: Number((data as any).dividend_stability) || 50,
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
    const t = ticker.trim().toUpperCase();
    if (!t || shares <= 0) { toast({ title: "Enter ticker and shares" }); return; }
    const { error } = await supabase.from("portfolio_positions").upsert({ user_id: userId, ticker: t, shares }, { onConflict: "user_id,ticker" });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setTicker(""); setShares(0);
    const { data } = await supabase.from("portfolio_positions").select("*").eq("user_id", userId).order("created_at");
    setPositions((data as Position[]) || []);
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
    const desiredUsername = (username || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: uid, username: desiredUsername || null, first_name: firstName || null, last_name: lastName || null, country });
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
      });
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Ranking preferences saved' });
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
  const exportCAEtfs = async () => {
    try {
      const columns = [
        'ticker','name','exchange','category','yield_ttm','total_return_1y','avg_volume','expense_ratio','volatility_1y','max_drawdown_1y','aum','manager','strategy_label','logo_key','country'
      ];
      const { data, error } = await supabase
        .from('etfs')
        .select(columns.join(','))
        .eq('country', 'CA')
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
      a.download = 'etfs_ca_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'CSV downloaded', description: `${(data || []).length} Canadian ETFs exported` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message || String(e), variant: 'destructive' });
    }
  };
  
  return (
    <div>
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <a href="/" className="font-bold text-lg tracking-tight" aria-label="HillJump home">HillJump</a>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <UserBadge />
          </nav>
        </div>
      </header>

      <main className="container py-8 grid gap-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        {!userId ? (
          <Card className="p-6">
            <p className="mb-4">Please sign in to manage your portfolio.</p>
            <Button asChild><a href="/auth">Go to Auth</a></Button>
          </Card>
        ) : (
          <>
            <Card className="p-4 grid gap-3">
              <div className="grid md:grid-cols-5 gap-2 items-end">
                <div>
                  <label className="block text-sm mb-1">Username</label>
                  <Input
                    placeholder="e.g., caseylessard"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">First name</label>
                  <Input placeholder="e.g., Alex" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Last name</label>
                  <Input placeholder="e.g., Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Country</label>
                  <Select value={country} onValueChange={(v) => setCountry(v as 'US' | 'CA')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Country" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CA">Canada 🇨🇦</SelectItem>
                      <SelectItem value="US">United States 🇺🇸</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={savePreferences} className="w-full">Save</Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Status: {approved ? <Badge variant="secondary">Approved</Badge> : <Badge variant="outline">Pending approval</Badge>}
              </div>
            </Card>

            <Card className="p-4 grid gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Ranking Preferences</div>
                  <div className="text-sm text-muted-foreground">Adjust weights and dividend stability for ETF rankings.</div>
                </div>
                <Button onClick={saveRanking}>Save Rankings</Button>
              </div>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Return Priority</span>
                  <Badge variant="secondary">{weights.r}%</Badge>
                </div>
                <Slider value={[weights.r]} onValueChange={([v]) => setWeights((w) => ({ ...w, r: v }))} min={0} max={100} step={1} />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">Yield Emphasis</span>
                  <Badge variant="secondary">{weights.y}%</Badge>
                </div>
                <Slider value={[weights.y]} onValueChange={([v]) => setWeights((w) => ({ ...w, y: v }))} min={0} max={100} step={1} />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">Risk Devaluation</span>
                  <Badge variant="secondary">{weights.k}%</Badge>
                </div>
                <Slider value={[weights.k]} onValueChange={([v]) => setWeights((w) => ({ ...w, k: v }))} min={0} max={100} step={1} />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">Dividend Stability Preference</span>
                  <Badge variant="secondary">{weights.d}%</Badge>
                </div>
                <Slider value={[weights.d]} onValueChange={([v]) => setWeights((w) => ({ ...w, d: v }))} min={0} max={100} step={1} />
              </div>
            </Card>

            <Card className="p-4 grid gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Subscription</div>
                  <div className="text-sm text-muted-foreground">Current: {subscribed ? (subscriptionTier ? subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1) : 'Active') : 'Free'}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={refreshSubscription}>Refresh</Button>
                  <Button onClick={manageSubscription}>Manage</Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Button onClick={() => upgrade('subscriber')}>Upgrade to Subscriber — $9/mo</Button>
                <Button variant="secondary" onClick={() => upgrade('premium')}>Upgrade to Premium — $29/mo</Button>
              </div>
            </Card>

            <Card className="p-4 grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Ticker (e.g., AAPL)" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
                <Input type="number" placeholder="Shares" value={shares} onChange={(e) => setShares(Number(e.target.value))} />
                <Button onClick={addOrUpdate}>Add / Update</Button>
              </div>
            </Card>

            <Card className="p-4 grid gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Export Canadian ETFs CSV</div>
                  <div className="text-sm text-muted-foreground">Includes manager, strategy_label, logo_key, and country fields.</div>
                </div>
                <Button onClick={exportCAEtfs}>Download CSV</Button>
              </div>
            </Card>

            <Card className="p-4 overflow-x-auto">
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
        <p className="text-xs text-muted-foreground">Not investment advice.</p>
      </main>
    </div>
  );
};

export default Profile;
