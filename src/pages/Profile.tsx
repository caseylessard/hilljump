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
import { useAdmin } from "@/hooks/useAdmin";
import Footer from "@/components/Footer";
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
  const [weights, setWeights] = useState({ r: 15, y: 25, k: 20, d: 20, t4: 8, t52: 2, h: 6 });
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [editShares, setEditShares] = useState<number>(0);
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

  const startEdit = (position: Position) => {
    setEditingPosition(position.id);
    setEditShares(Number(position.shares));
  };

  const cancelEdit = () => {
    setEditingPosition(null);
    setEditShares(0);
  };

  const saveEdit = async (id: string, ticker: string) => {
    if (!userId) return;
    
    if (editShares <= 0 || editShares > 1000000 || !isFinite(editShares)) {
      toast({ title: "Invalid shares", description: "Please enter a valid number of shares (0.01 - 1,000,000)" });
      return;
    }

    const { error } = await supabase.from("portfolio_positions").update({ 
      shares: editShares 
    }).eq("id", id);
    
    if (error) { 
      toast({ title: "Update failed", description: error.message, variant: "destructive" }); 
      return; 
    }
    
    // Update local state
    setPositions(prev => prev.map(p => 
      p.id === id ? { ...p, shares: editShares } : p
    ));
    
    setEditingPosition(null);
    setEditShares(0);
    toast({ title: "Position updated successfully" });
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

  return (
    <div>
      <Navigation />

      <main className="container py-4 px-3 sm:py-8 sm:px-6 grid gap-4 sm:gap-6 max-w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Profile</h1>
        
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
                <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                  <Button variant="outline" onClick={refreshSubscription} size="sm" className="min-w-0">Refresh</Button>
                  <Button onClick={manageSubscription} size="sm" className="min-w-0">Manage</Button>
                  <Button variant="outline" onClick={resetPassword} size="sm" className="min-w-0 whitespace-nowrap">Reset Password</Button>
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = '/';
                    }}
                    size="sm"
                    className="min-w-0"
                  >
                    Log Out
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={() => upgrade('subscriber')} className="text-xs sm:text-sm">
                  <span className="block sm:hidden">Subscriber — $9/mo</span>
                  <span className="hidden sm:block">Upgrade to Subscriber — $9/mo</span>
                </Button>
                <Button variant="secondary" onClick={() => upgrade('premium')} className="text-xs sm:text-sm">
                  <span className="block sm:hidden">Premium — $29/mo</span>
                  <span className="hidden sm:block">Upgrade to Premium — $29/mo</span>
                </Button>
              </div>
            </Card>

            {/* Portfolio Section - Only for subscribers/admins */}
            {(subscribed || isAdmin) && (
              <>
                <Card className="p-4 grid gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Portfolio Management</div>
                      <div className="text-sm text-muted-foreground">Manage your holdings on the Portfolio page</div>
                    </div>
                    <Button asChild>
                      <a href="/portfolio">Go to Portfolio</a>
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
