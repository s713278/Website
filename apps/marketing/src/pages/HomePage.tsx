import { Hero } from '../sections/Hero';
import { HowItWorks, SiteFooter, VendorShowcase } from '../sections/HowItWorks';
import { SiteHeader } from '../sections/SiteHeader';
import { sampleStoreUrl } from '../config';

export function HomePage() {
  return (
    <div className="md-body min-h-screen">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <VendorShowcase />
      </main>
      <SiteFooter />
      <a
        href={sampleStoreUrl()}
        data-cta="sticky_sample"
        className="md-btn md-btn-primary fixed bottom-4 right-4 z-30 shadow-[var(--shadow-md)] md:hidden"
      >
        Open sample store
      </a>
    </div>
  );
}
