import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { UserBadge } from "@/components/UserBadge";
import Navigation from "@/components/Navigation";
import { useInputValidation, emailSchema, passwordSchema } from "@/hooks/useInputValidation";
import { useSecurityMonitoring } from "@/hooks/useSecurityMonitoring";
import { sanitizeEmail, checkRateLimitSync } from "@/utils/sanitization";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { Github, Phone, Mail } from "lucide-react";
import Footer from "@/components/Footer";

const Auth = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [tab, setTab] = useState("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
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

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/profile`
        }
      });
      
      if (error) throw error;
    } catch (e: any) {
      toast({ title: "Google sign-in failed", description: e.message, variant: "destructive" });
    }
  };

  const signInWithGithub = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/profile`
        }
      });
      
      if (error) throw error;
    } catch (e: any) {
      toast({ title: "GitHub sign-in failed", description: e.message, variant: "destructive" });
    }
  };

  const signInWithPhone = async () => {
    try {
      setPhoneLoading(true);
      
      if (!phone || phone.length < 10) {
        toast({ title: "Invalid phone number", description: "Please enter a valid phone number", variant: "destructive" });
        return;
      }

      // Format phone number to E.164 format (assuming US/CA format for simplicity)
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms'
        }
      });
      
      if (error) throw error;
      
      toast({ 
        title: "SMS sent", 
        description: "Check your phone for the verification code. You'll be redirected to complete sign-in." 
      });
    } catch (e: any) {
      toast({ title: "Phone sign-in failed", description: e.message, variant: "destructive" });
    } finally {
      setPhoneLoading(false);
    }
  };

  const sendPasswordResetEmail = async () => {
    try {
      setResetLoading(true);
      
      const sanitizedEmail = sanitizeEmail(resetEmail);
      if (!sanitizedEmail) {
        toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      
      toast({ 
        title: "Reset email sent", 
        description: "Check your email for the password reset link" 
      });
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (e: any) {
      toast({ title: "Failed to send reset email", description: e.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
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
            <TabsContent value="signin" className="space-y-4">
              {showForgotPassword ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold">Reset Password</h2>
                    <p className="text-sm text-muted-foreground">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </div>
                  <Input 
                    type="email" 
                    placeholder="Email" 
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)}
                    maxLength={254}
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={sendPasswordResetEmail} 
                      disabled={resetLoading || !resetEmail}
                      className="flex-1"
                    >
                      {resetLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetEmail("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* SSO Options */}
                  <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={signInWithGoogle} 
                  className="w-full"
                  type="button"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button 
                  variant="outline" 
                  onClick={signInWithGithub} 
                  className="w-full"
                  type="button"
                >
                  <Github className="w-4 h-4 mr-2" />
                  Continue with GitHub
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {/* Email/Password */}
              <form onSubmit={(e) => { e.preventDefault(); signIn(); }} className="space-y-3">
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
                <Button type="submit" disabled={loading} className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  {loading ? "Signing in..." : "Sign in with Email"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or use phone</span>
                </div>
              </div>

              {/* Phone Authentication */}
              <div className="space-y-3">
                <Input 
                  type="tel" 
                  placeholder="Phone number (e.g., +1234567890)" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                />
                <Button onClick={signInWithPhone} disabled={phoneLoading} variant="outline" className="w-full">
                  <Phone className="w-4 h-4 mr-2" />
                  {phoneLoading ? "Sending SMS..." : "Sign in with Phone"}
                </Button>
              </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="signup" className="space-y-4">
              {/* SSO Options */}
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={signInWithGoogle} 
                  className="w-full"
                  type="button"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button 
                  variant="outline" 
                  onClick={signInWithGithub} 
                  className="w-full"
                  type="button"
                >
                  <Github className="w-4 h-4 mr-2" />
                  Continue with GitHub
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or create account with</span>
                </div>
              </div>

              {/* Email/Password */}
              <form onSubmit={(e) => { e.preventDefault(); signUp(); }} className="space-y-3">
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
                  type="submit"
                  disabled={loading || hasErrors || !email || !password} 
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {loading ? "Creating account..." : "Create Account with Email"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or use phone</span>
                </div>
              </div>

              {/* Phone Authentication */}
              <div className="space-y-3">
                <Input 
                  type="tel" 
                  placeholder="Phone number (e.g., +1234567890)" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                />
                <Button onClick={signInWithPhone} disabled={phoneLoading} variant="outline" className="w-full">
                  <Phone className="w-4 h-4 mr-2" />
                  {phoneLoading ? "Sending SMS..." : "Sign up with Phone"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;