import { sampleStoreUrl, vendorOnboardingUrl } from '../config';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(16,185,129,0.18), transparent), radial-gradient(ellipse 60% 50% at 90% 20%, rgba(6,78,59,0.12), transparent), linear-gradient(180deg,#f3f7f4,#fff)',
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div className="md-fade-in">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            WhatsApp commerce for local makers
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
            MithraDirect
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Publish a branded storefront in minutes. Customers add to cart, check out, and send the order on
            WhatsApp — you confirm and deliver.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={vendorOnboardingUrl()} data-cta="hero_create_store" className="md-btn md-btn-primary">
              Create your store
            </a>
            <a href={sampleStoreUrl()} data-cta="hero_sample_store" className="md-btn md-btn-outline">
              Try sample store
            </a>
          </div>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-white/70 p-6 shadow-[var(--shadow-md)] backdrop-blur md-fade-in">
          <p className="text-sm font-semibold text-emerald-800">Live demo</p>
          <p className="mt-2 text-2xl font-[family-name:var(--font-display)] font-bold text-slate-900">
            Sai Ram Home Foods
          </p>
          <p className="mt-1 text-slate-600">Pickles, podulu & snacks — Guntur, AP</p>
          <a
            href={sampleStoreUrl('menu')}
            data-cta="hero_wa_checkout"
            className="md-btn md-btn-wa mt-6"
          >
            See WhatsApp checkout
          </a>
        </div>
      </div>
    </section>
  );
}
