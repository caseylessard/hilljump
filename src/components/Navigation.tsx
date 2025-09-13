import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/UserBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
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
    { href: "/", label: "Home" },
    { href: "/ranking", label: "Income" }
  ];

  // Auth-only navigation items
  const authOnlyNavItems = [
    { href: "/portfolio", label: "Portfolio" }, 
    { href: "/bots", label: "Bots" },
    { href: "/breakout", label: "Breakout" },
    { href: "/options", label: "Options" },
    { href: "/crypto", label: "Crypto" }
  ];

  // Build final nav items based on auth status
  const navItems = isAuthenticated 
    ? [...baseNavItems, ...authOnlyNavItems]
    : baseNavItems;

  // Add admin link for admin users
  if (isAdmin) {
    navItems.push({ href: "/admin", label: "Admin" });
  }

  if (isMobile) {
    return (
      <header className="border-b">
        <div className="w-full max-w-none px-4 flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2 font-jersey font-bold text-lg tracking-tight" aria-label="HillJump home">
          <img src="/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png" alt="HillJump Logo" className="w-8 h-8" />
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
                    <Button key={item.href} variant="ghost" asChild className="justify-start font-jersey">
                      <a href={item.href} onClick={() => setIsOpen(false)}>
                        {item.label}
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
      <div className="w-full max-w-none px-4 flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2 font-jersey font-bold text-lg tracking-tight" aria-label="HillJump home">
          <img src="/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png" alt="HillJump Logo" className="w-8 h-8" />
          HillJump
        </a>
        <nav className="flex items-center gap-2" aria-label="Primary">
          {navItems.map((item) => (
            <Button key={item.href} variant="ghost" asChild className="font-jersey">
              <a href={item.href}>{item.label}</a>
            </Button>
          ))}
          <UserBadge />
        </nav>
      </div>
    </header>
  );
};

export default Navigation;