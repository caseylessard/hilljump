import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { UserBadge } from "@/components/UserBadge";

const Auth = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("signin");

  // SEO
  useEffect(() => {
    document.title = "HillJump — Sign In / Sign Up";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => { const m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); return m as HTMLMetaElement; })();
    meta.setAttribute('content', 'Sign in or create your HillJump account to manage your portfolio.');
  }, []);


  const signIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "Welcome back", description: "Signed in successfully" });
      navigate("/profile");
    } catch (e: any) {
      toast({ title: "Sign in failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/profile` },
      });
      if (error) throw error;
      toast({ title: "Check your email", description: "We sent a confirmation link" });
    } catch (e: any) {
      toast({ title: "Sign up failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <a href="/" className="font-bold text-lg tracking-tight" aria-label="HillJump home">HillJump</a>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <Button variant="ghost" asChild><a href="/">Ranking</a></Button>
            <Button variant="ghost" asChild><a href="/scoring">Scoring</a></Button>
            <Button variant="ghost" asChild><a href="/profile">Profile</a></Button>
          </nav>
        </div>
      </header>

      <main className="container py-10 max-w-md">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold mb-4">Sign in or create account</h1>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-3">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button onClick={signIn} disabled={loading} className="w-full">Sign In</Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-3">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button onClick={signUp} disabled={loading} className="w-full">Create Account</Button>
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-3">By continuing you agree to our terms. Not investment advice.</p>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
