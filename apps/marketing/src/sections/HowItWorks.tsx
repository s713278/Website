import { sampleStoreUrl, vendorOnboardingUrl } from '../config';

const steps = [
  { title: 'Verify mobile', body: 'OTP login for store owners.' },
  { title: 'Add catalog', body: 'Categories, products, SKUs & prices.' },
  { title: 'Go live', body: 'Share your store link. Orders arrive on WhatsApp.' },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900">How it works</h2>
      <p className="mt-2 max-w-2xl text-slate-600">One job per step — from phone verify to WhatsApp orders.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]">
            <div className="text-sm font-bold text-emerald-700">Step {i + 1}</div>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-10">
        <a href={vendorOnboardingUrl()} data-cta="how_start_free" className="md-btn md-btn-primary">
          Start free setup
        </a>
      </div>
    </section>
  );
}

export function VendorShowcase() {
  return (
    <section className="border-y border-emerald-50 bg-emerald-50/40 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900">
          Featured storefront
        </h2>
        <a
          href={sampleStoreUrl()}
          data-cta="showcase_view_live"
          className="mt-6 block rounded-2xl border border-emerald-100 bg-white p-6 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
        >
          <p className="text-sm font-semibold text-emerald-700">View live store</p>
          <p className="mt-1 text-2xl font-[family-name:var(--font-display)] font-bold">Sai Ram Home Foods</p>
          <p className="mt-1 text-slate-600">Homemade food with daily local delivery — try the sample storefront</p>
        </a>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] font-bold text-slate-900">MithraDirect</p>
          <p className="text-sm text-slate-500">Local support, direct connection.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <a href="/privacy" className="text-slate-600 hover:text-emerald-700">
            Privacy
          </a>
          <a href="/terms" className="text-slate-600 hover:text-emerald-700">
            Terms
          </a>
          <a href={vendorOnboardingUrl()} data-cta="footer_start" className="font-semibold text-emerald-700">
            Start free setup
          </a>
        </div>
      </div>
    </footer>
  );
}
