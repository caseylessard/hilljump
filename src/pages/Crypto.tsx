import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import DailyAlerts from "@/components/alerts/DailyAlerts";

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
        <div className="container py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Crypto</h1>
        </div>
      </header>

      <main className="container grid gap-6 sm:gap-8 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="crypto-alerts">
          <h2 id="crypto-alerts" className="sr-only">Daily Crypto Alerts</h2>
          <DailyAlerts />
        </section>
      </main>
    </div>
  );
};

export default Crypto;
