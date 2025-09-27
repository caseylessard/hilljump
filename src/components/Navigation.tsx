import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/UserBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, CircleDollarSign, LockKeyhole, Home, Briefcase, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";

const Navigation = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const { isAdmin } = useAdmin();
  const { userId, profile, loading } = useUserProfile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  function flagEmoji(country: 'US' | 'CA' | undefined) {
    return country === 'US' ? '🇺🇸' : '🇨🇦';
  }

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Base navigation items - always visible
  const baseNavItems = [
    { href: "/ranking", label: "Income", icon: "lucide", lucideIcon: CircleDollarSign }
  ];

  // Auth-only navigation items (for hamburger menu)
  const authOnlyNavItems = [
    { href: "/portfolio", label: "Portfolio", icon: "lucide", lucideIcon: Briefcase }
  ];

  // Build hamburger nav items (excludes income which is always visible on mobile)
  const hamburgerNavItems = isAuthenticated 
    ? authOnlyNavItems
    : [];

  // Build desktop nav items (includes all items)
  const navItems = isAuthenticated 
    ? [...baseNavItems, ...authOnlyNavItems]
    : baseNavItems;

  // Add admin link for admin users
  if (isAdmin) {
    hamburgerNavItems.push({ href: "/admin", label: "Admin", icon: "lucide", lucideIcon: LockKeyhole });
    navItems.push({ href: "/admin", label: "Admin", icon: "lucide", lucideIcon: LockKeyhole });
  }

  if (isMobile) {
    return (
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2 font-vt323 font-bold text-2xl tracking-tight" aria-label="HillJump home">
          <img src="/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png" alt="HillJump Logo" className="w-10 h-10" />
          HillJump
        </a>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <a href="/ranking" aria-label="Income">
                <CircleDollarSign className="h-5 w-5" />
              </a>
            </Button>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <nav className="flex flex-col gap-4 mt-8" aria-label="Primary">
                  {hamburgerNavItems.map((item) => (
                    <Button key={item.href} variant="ghost" asChild className="justify-start font-roboto text-sm">
                      <a href={item.href} onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                        <item.lucideIcon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </a>
                    </Button>
                  ))}
                  <div className="border-t pt-4">
                    {loading ? (
                      <Button variant="ghost" disabled className="justify-start font-roboto text-sm">
                        <User className="h-4 w-4 mr-3" />
                        Loading...
                      </Button>
                    ) : !userId ? (
                      <Button variant="ghost" asChild className="justify-start font-roboto text-sm">
                        <a href="/auth" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                          <User className="h-4 w-4" />
                          <span>Sign In</span>
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" asChild className="justify-start font-roboto text-sm">
                        <a href="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                          <div className="relative">
                            <User className="h-4 w-4" />
                            <span className="absolute -top-1 -right-1 text-xs" aria-hidden>
                              {flagEmoji(profile?.country as any)}
                            </span>
                          </div>
                          <span>
                            {profile?.first_name || profile?.username || "Profile"}
                          </span>
                        </a>
                      </Button>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b">
      <div className="container flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2 font-vt323 font-bold text-2xl tracking-tight" aria-label="HillJump home">
          <img src="/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png" alt="HillJump Logo" className="w-10 h-10" />
          HillJump
        </a>
        <nav className="flex items-center gap-2" aria-label="Primary">
          {navItems.map((item) => (
            <Button key={item.href} variant="ghost" asChild className="font-roboto text-sm">
              <a href={item.href} className="flex items-center gap-2">
                <item.lucideIcon className="h-4 w-4 lg:h-4 lg:w-4" />
                <span className="hidden lg:inline">{item.label}</span>
              </a>
            </Button>
          ))}
          <Button variant="ghost" asChild className="font-roboto text-sm">
            <a href={isAuthenticated ? "/profile" : "/auth"} className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <div className="relative">
                    <User className="h-4 w-4" />
                    <span className="absolute -top-1 -right-1 text-xs lg:hidden" aria-hidden>
                      {flagEmoji(profile?.country as any)}
                    </span>
                  </div>
                  <span className="hidden lg:flex lg:items-center lg:gap-2">
                    <span>{flagEmoji(profile?.country as any)}</span>
                    <span>{profile?.first_name || profile?.username || "Profile"}</span>
                  </span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4" />
                  <span className="hidden lg:inline">Sign In</span>
                </>
              )}
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default Navigation;