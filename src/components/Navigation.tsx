import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/UserBadge";

const Navigation = () => {
  return (
    <header className="border-b">
      <div className="container flex items-center justify-between py-4">
        <a href="/" className="font-bold text-lg tracking-tight" aria-label="HillJump home">
          HillJump
        </a>
        <nav className="flex items-center gap-2" aria-label="Primary">
          <Button variant="ghost" asChild>
            <a href="/">Dividends</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/options">Options</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/crypto">Crypto</a>
          </Button>
          <UserBadge />
        </nav>
      </div>
    </header>
  );
};

export default Navigation;