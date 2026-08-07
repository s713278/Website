import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function OnboardingSummaryBar() {
  const categories = useOnboardingStore((s) => s.categories);
  const products = useOnboardingStore((s) => s.products);
  const settings = useOnboardingStore((s) => s.settings);
  const phone = useOnboardingStore((s) => s.phone);

  const namedProducts = products.filter((p) => p.name.trim()).length;
  const skus = products.reduce(
    (n, p) => n + p.variants.filter((v) => Number(v.price) > 0).length,
    0,
  );
  const wa = settings.whatsapp || phone;
  const waLabel = /^\d{10}$/.test(wa) ? `+91 ${wa}` : 'Pending';

  return (
    <footer className="summary-bar">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 text-center sm:grid-cols-5 sm:px-2 sm:text-left">
        <Stat label="Total Time" value="~10 Minutes" />
        <Stat label="Categories" value={`${categories.length} Selected`} />
        <Stat label="Products" value={`${namedProducts} Added`} />
        <Stat label="SKUs" value={`${skus} Configured`} />
        <Stat label="WhatsApp Orders" value={waLabel} className="col-span-2 sm:col-span-1" />
      </div>
    </footer>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
