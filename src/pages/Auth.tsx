import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { UserBadge } from "@/components/UserBadge";
import Navigation from "@/components/Navigation";
import { useInputValidation, emailSchema, passwordSchema } from "@/hooks/useInputValidation";
import { useSecurityMonitoring } from "@/hooks/useSecurityMonitoring";
import { sanitizeEmail, checkRateLimitSync } from "@/utils/sanitization";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

const Auth = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("signin");
  const { validateField, getFieldError, clearErrors, hasErrors } = useInputValidation();
  const { logFailedLogin, logSuccessfulLogin, logSuspiciousActivity } = useSecurityMonitoring();

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
      
      const sanitizedEmail = sanitizeEmail(email);
      if (!sanitizedEmail) {
        toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
        return;
      }

      // Rate limiting check
      if (!checkRateLimitSync(`signin_${sanitizedEmail}`, 5, 15 * 60 * 1000)) {
        toast({ title: "Too many attempts", description: "Please try again in 15 minutes", variant: "destructive" });
        await logSuspiciousActivity('rate_limit_exceeded', { email: sanitizedEmail, action: 'signin' });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ 
        email: sanitizedEmail, 
        password 
      });
      
      if (error) {
        await logFailedLogin(sanitizedEmail, error.message);
        throw error;
      }
      
      await logSuccessfulLogin();
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
      
      const sanitizedEmail = sanitizeEmail(email);
      
      // Validate inputs with enhanced security
      const emailValid = validateField('email', sanitizedEmail, emailSchema);
      const passwordValid = validateField('password', password, passwordSchema);

      if (!emailValid || !passwordValid) {
        setLoading(false);
        return;
      }

      // Rate limiting check
      if (!checkRateLimitSync(`signup_${sanitizedEmail}`, 3, 60 * 60 * 1000)) {
        toast({ title: "Too many attempts", description: "Please try again in 1 hour", variant: "destructive" });
        await logSuspiciousActivity('rate_limit_exceeded', { email: sanitizedEmail, action: 'signup' });
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: { 
          emailRedirectTo: `${window.location.origin}/profile` 
        },
      });
      
      if (error) {
        await logFailedLogin(sanitizedEmail, error.message);
        throw error;
      }
      
      toast({ title: "Check your email", description: "We sent a confirmation link" });
    } catch (e: any) {
      toast({ title: "Sign up failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navigation />

      <main className="container py-10 max-w-md">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold mb-4">Sign in or create account</h1>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-3">
              <div>
                <Input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                />
                {getFieldError('email') && (
                  <p className="text-sm text-red-500 mt-1">{getFieldError('email')}</p>
                )}
              </div>
              <div>
                <Input 
                  type="password" 
                  placeholder="Password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                />
              </div>
              <Button onClick={signIn} disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-3">
              <div>
                <Input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                />
                {getFieldError('email') && (
                  <p className="text-sm text-red-500 mt-1">{getFieldError('email')}</p>
                )}
              </div>
               <div>
                <Input 
                  type="password" 
                  placeholder="Password" 
                  value={password} 
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value) {
                      validateField('password', e.target.value, passwordSchema);
                    }
                  }}
                  maxLength={128}
                />
                {getFieldError('password') && (
                  <p className="text-sm text-red-500 mt-1">{getFieldError('password')}</p>
                )}
                <PasswordStrengthIndicator password={password} show={tab === 'signup'} />
              </div>
              <Button 
                onClick={signUp} 
                disabled={loading || hasErrors || !email || !password} 
                className="w-full"
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-3">By continuing you agree to our terms. Not investment advice.</p>
        </Card>
      </main>
    </div>
  );
};

export default Auth;