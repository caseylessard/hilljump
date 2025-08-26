import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/UserBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

const Navigation = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Income" },
    { href: "/portfolio", label: "Portfolio" }, 
    { href: "/bots", label: "Bots" },
    { href: "/options", label: "Options" },
    { href: "/crypto", label: "Crypto" }
  ];

  if (isMobile) {
    return (
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <a href="/" className="font-bold text-lg tracking-tight" aria-label="HillJump home">
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
                    <Button key={item.href} variant="ghost" asChild className="justify-start">
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
      <div className="container flex items-center justify-between py-4">
        <a href="/" className="font-bold text-lg tracking-tight" aria-label="HillJump home">
          HillJump
        </a>
        <nav className="flex items-center gap-2" aria-label="Primary">
          {navItems.map((item) => (
            <Button key={item.href} variant="ghost" asChild>
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