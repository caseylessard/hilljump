import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = "Privacy Policy — HillJump";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'HillJump privacy policy explaining data collection, usage, and your rights.');

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
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-4 text-muted-foreground">Last updated: September 28, 2025</p>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <article className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed mb-8">
            HillJump values your privacy. This policy explains what information we collect, how we use it, and your rights.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Information We Collect</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li><strong>You provide:</strong> Account details such as your name, email, and password.</li>
              <li><strong>Automatically collected:</strong> Device type, IP address, and usage data through analytics or cookies.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">How We Use Your Information</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>To provide, improve, and secure HillJump.</li>
              <li>To communicate with you about updates, support, or important notices.</li>
              <li>To comply with Nunavut, Canadian, and applicable international laws.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Sharing of Information</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>We do not sell your personal data.</li>
              <li>We may share data with trusted service providers (hosting, analytics, etc.).</li>
              <li>We may disclose data if required by law or to protect our rights.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Your Rights</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>Request a copy of your personal data.</li>
              <li>Request correction or deletion of your data.</li>
              <li>Opt out of marketing communications at any time.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Data Security</h2>
            <p className="text-muted-foreground">
              We use reasonable safeguards to protect your data, but no system is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Contact</h2>
            <p className="text-muted-foreground">
              If you have questions about this policy, contact us at:
            </p>
            <p className="mt-2">
              📧 <a href="mailto:info@hilljump.com" className="text-primary hover:underline">info@hilljump.com</a>
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;