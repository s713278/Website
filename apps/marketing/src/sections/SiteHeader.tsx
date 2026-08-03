import { sampleStoreUrl, vendorOnboardingUrl } from '../config';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="/" className="font-[family-name:var(--font-display)] text-lg font-bold text-emerald-900">
          MithraDirect
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          <a href={sampleStoreUrl()} data-cta="nav_sample_store" className="hover:text-emerald-700">
            Sample Store
          </a>
          <a href={vendorOnboardingUrl()} data-cta="nav_create_store" className="hover:text-emerald-700">
            Create your store
          </a>
        </nav>
        <a
          href={vendorOnboardingUrl()}
          data-cta="nav_primary_create"
          className="md-btn md-btn-primary md-btn-sm"
        >
          Create your store
        </a>
      </div>
    </header>
  );
}
