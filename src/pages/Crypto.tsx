import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { UserBadge } from "@/components/UserBadge";
import Navigation from "@/components/Navigation";

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
      <Navigation />
      <header className="relative overflow-hidden">
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
