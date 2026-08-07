import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

/** Live phone preview styled after store.html home hero + product grid. */
export function StorefrontPreview() {
  const settings = useOnboardingStore((s) => s.settings);
  const categories = useOnboardingStore((s) => s.categories);
  const products = useOnboardingStore((s) => s.products);
  const delivery = useOnboardingStore((s) => s.delivery);
  const theme = settings.themeColor || '#10b981';
  const namedProducts = products.filter((p) => p.name.trim()).slice(0, 4);
  const hasHome = delivery.homeDelivery.enabled || delivery.courierDelivery.enabled;

  return (
    <div className="preview-sticky">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
        Storefront Preview (Live)
      </p>
      <div className="phone-frame">
        <div className="phone-screen">
        {/* store-header */}
        <div className="flex h-11 items-center justify-between border-b border-gray-100 px-3">
          <span className="text-lg text-gray-500" aria-hidden>
            ☰
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            {settings.logoDataUrl ? (
              <img src={settings.logoDataUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
            ) : (
              <span className="text-sm" aria-hidden>
                🏪
              </span>
            )}
            <span className="font-display truncate text-xs font-bold text-gray-900">
              {settings.storeName || 'Your store'}
            </span>
          </div>
          <span
            className="relative text-sm"
            style={{ color: theme }}
            aria-hidden
          >
            🛒
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[8px] font-bold text-white">
              0
            </span>
          </span>
        </div>

        {/* store-hero */}
        <div
          className="relative flex min-h-[140px] flex-col justify-end px-3 pb-3 pt-8 text-white"
          style={{
            backgroundColor: theme,
            backgroundImage: settings.bannerDataUrl
              ? `linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.55)), url(${settings.bannerDataUrl})`
              : `linear-gradient(145deg, ${theme}, color-mix(in srgb, ${theme} 70%, #064e3b))`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <span className="mb-1 w-fit rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold backdrop-blur">
            100% Homemade
          </span>
          <h3 className="font-display text-base font-bold leading-tight">
            {settings.storeName || 'Your store name'}
          </h3>
          <p className="mt-0.5 text-[10px] text-white/90">
            {settings.tagline || 'Your tagline appears here'}
          </p>
          <p className="mt-0.5 text-[10px] text-white/80">
            {settings.location || 'Add your location'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px]">No preservatives</span>
            {hasHome ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px]">Home delivery</span>
            ) : (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px]">Store pickup</span>
            )}
          </div>
        </div>

        <div className="space-y-3 p-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-2.5 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
              Delivering to
            </p>
            <p className="text-[11px] font-medium text-gray-800">Add your delivery address</p>
          </div>

          {categories.length ? (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: theme }}
              >
                All
              </span>
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-700"
                >
                  {c.name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {namedProducts.length
              ? namedProducts.map((p) => {
                  const price = p.variants.find((v) => Number(v.price) > 0)?.price;
                  return (
                    <div
                      key={p.id}
                      className="overflow-hidden rounded-xl border border-gray-100 shadow-sm"
                    >
                      <div
                        className="flex h-[4.5rem] items-center justify-center text-lg"
                        style={{
                          background: p.imageDataUrl
                            ? `center/cover url(${p.imageDataUrl})`
                            : p.color,
                        }}
                        aria-hidden
                      >
                        {!p.imageDataUrl ? '🛒' : null}
                      </div>
                      <div className="p-2">
                        <div className="truncate text-[11px] font-semibold text-gray-900">
                          {p.name}
                        </div>
                        <div className="mt-0.5 text-[10px] font-bold" style={{ color: theme }}>
                          {price ? `₹${price}` : 'Set price'}
                        </div>
                      </div>
                    </div>
                  );
                })
              : Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 rounded-xl border border-dashed border-gray-200 bg-gray-50"
                  />
                ))}
          </div>

          <div
            className="rounded-full px-3 py-2.5 text-center text-[11px] font-bold text-white"
            style={{ backgroundColor: theme }}
          >
            Order on WhatsApp
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
