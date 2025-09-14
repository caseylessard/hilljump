import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/UserBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, CircleDollarSign, TrendingUp, ChartCandlestick, Bitcoin, LockKeyhole, Home, Briefcase, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

const Navigation = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const { isAdmin } = useAdmin();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
    { href: "/", label: "Home", icon: "lucide", lucideIcon: Home },
    { href: "/ranking", label: "Income", icon: "lucide", lucideIcon: CircleDollarSign }
  ];

  // Auth-only navigation items
  const authOnlyNavItems = [
    { href: "/portfolio", label: "Portfolio", icon: "lucide", lucideIcon: Briefcase }, 
    { href: "/bots", label: "Bots", icon: "lucide", lucideIcon: Bot },
    { href: "/breakout", label: "Breakout", icon: "lucide", lucideIcon: TrendingUp },
    { href: "/options", label: "Options", icon: "lucide", lucideIcon: ChartCandlestick },
    { href: "/crypto", label: "Crypto", icon: "lucide", lucideIcon: Bitcoin }
  ];

  // Build final nav items based on auth status
  const navItems = isAuthenticated 
    ? [...baseNavItems, ...authOnlyNavItems]
    : baseNavItems;

  // Add admin link for admin users
  if (isAdmin) {
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
            <UserBadge />
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <nav className="flex flex-col gap-4 mt-8" aria-label="Primary">
                  {navItems.map((item) => (
                    <Button key={item.href} variant="ghost" asChild className="justify-start font-roboto text-sm">
                      <a href={item.href} onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                        <item.lucideIcon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </a>
                    </Button>
                  ))}
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
                <item.lucideIcon className="h-4 w-4 lg:hidden" />
                <span className="hidden lg:inline">{item.label}</span>
              </a>
            </Button>
          ))}
          <UserBadge />
        </nav>
      </div>
    </header>
  );
};

export default Navigation;