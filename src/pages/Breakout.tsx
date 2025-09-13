import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import DailyAlerts from "@/components/alerts/DailyAlerts";

const Breakout = () => {
  useEffect(() => {
    document.title = "HillJump — Breakout Alerts";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'Daily equity breakout alerts with entry points, targets, and risk management.');

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
        <div className="w-full max-w-none px-4 py-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Breakout Alerts</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Daily equity breakout opportunities with precise entry points, stop losses, and profit targets.
          </p>
        </div>
      </header>

      <main className="w-full max-w-none px-4 grid gap-8 pb-16">
        <section aria-labelledby="alerts-section">
          <h2 id="alerts-section" className="sr-only">Daily Alerts</h2>
          <DailyAlerts />
        </section>
      </main>
    </div>
  );
};

export default Breakout;