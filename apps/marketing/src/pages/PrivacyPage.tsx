import { SiteHeader } from '../sections/SiteHeader';
import { SiteFooter } from '../sections/HowItWorks';

export function PrivacyPage() {
  return (
    <div className="md-body min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Privacy</h1>
        <p className="mt-4 text-slate-600">
          See the prototype legal page or your production privacy policy. This React shell links here for
          navigation parity.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="md-body min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Terms & Conditions</h1>
        <p className="mt-4 text-slate-600">
          See the prototype terms page or your production terms. This React shell links here for navigation
          parity.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
