import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const Crypto = () => {
  useEffect(() => {
    document.title = "HillJump — Crypto";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'Track crypto markets and income strategies.');

    const link =
      (document.querySelector('link[rel="canonical"]') as HTMLLinkElement) ||
      (() => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        document.head.appendChild(l);
        return l as HTMLLinkElement;
      })();
    link.setAttribute('href', window.location.origin + window.location.pathname);
  }, []);

  return (
    <div>
      <header className="relative overflow-hidden">
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
            <Button variant="ghost" asChild>
              <a href="/profile">Profile</a>
            </Button>
          </nav>
        </div>
        <div className="container py-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Crypto</h1>
        </div>
      </header>

      <main className="container grid gap-8 pb-16">
        <section aria-labelledby="crypto-intro">
          <h2 id="crypto-intro" className="sr-only">Introduction</h2>
          <p className="text-muted-foreground">Content coming soon.</p>
        </section>
      </main>
    </div>
  );
};

export default Crypto;
