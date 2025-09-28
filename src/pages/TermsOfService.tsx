import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const TermsOfService = () => {
  useEffect(() => {
    document.title = "Terms of Service — HillJump";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'HillJump terms of service covering eligibility, app usage, content rights, and user responsibilities.');

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
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-4 text-muted-foreground">Last updated: September 28, 2025</p>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <article className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed mb-8">
            Welcome to HillJump. By using our app, you agree to these terms.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Eligibility</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>You must be at least 18 years old to use HillJump.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Use of the App</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>You agree not to misuse HillJump (e.g., hacking, reverse engineering, illegal activity, or violating others' rights).</li>
              <li>We may suspend or terminate accounts that break these rules.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Content</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>You retain ownership of any content you create or upload.</li>
              <li>By using HillJump, you grant us permission to display, process, and store content as needed to operate the service.</li>
              <li>We are not responsible for the accuracy, completeness, or reliability of user-generated content.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Disclaimer of Warranties</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>HillJump is provided "as is" without warranties of any kind.</li>
              <li>We do not guarantee uninterrupted service, accuracy of data, or future performance of financial products.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Limitation of Liability</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>HillJump is not liable for any damages, financial losses, or other claims resulting from your use of the app.</li>
              <li>Use of financial data, rankings, or insights is at your own risk.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Changes</h2>
            <p className="text-muted-foreground">
              We may update these terms at any time. Continued use of HillJump means you accept the revised terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Governing Law</h2>
            <p className="text-muted-foreground">
              These terms are governed by the laws of Nunavut, Canada.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;