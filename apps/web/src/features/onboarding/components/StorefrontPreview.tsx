import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StorefrontPreview() {
  const settings = useOnboardingStore((s) => s.settings);
  const categories = useOnboardingStore((s) => s.categories);
  const products = useOnboardingStore((s) => s.products);
  const theme = settings.themeColor || '#10b981';
  const namedProducts = products.filter((p) => p.name.trim()).slice(0, 4);

  return (
    <div className="lg:sticky lg:top-24">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
        Storefront Preview (Live)
      </p>
      <div className="mx-auto w-[280px] rounded-[2rem] border-[10px] border-gray-900 bg-gray-900 p-2 shadow-2xl">
        <div className="overflow-hidden rounded-[1.35rem] bg-white" style={{ minHeight: 480 }}>
          <div
            className="relative h-28 bg-cover bg-center"
            style={{
              backgroundColor: theme,
              backgroundImage: settings.bannerDataUrl
                ? `url(${settings.bannerDataUrl})`
                : undefined,
            }}
          >
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end gap-2">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white text-lg shadow">
                {settings.logoDataUrl ? (
                  <img src={settings.logoDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>🏪</span>
                )}
              </div>
              <div className="min-w-0 text-white">
                <div className="truncate text-sm font-bold">
                  {settings.storeName || 'Your store name'}
                </div>
                <div className="truncate text-[11px] text-white/90">
                  {settings.tagline || 'Your tagline appears here'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3">
            {categories.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <span
                    key={c.id}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: theme }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400">Categories will show here</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {namedProducts.length
                ? namedProducts.map((p) => {
                    const price = p.variants.find((v) => Number(v.price) > 0)?.price;
                    return (
                      <div
                        key={p.id}
                        className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
                      >
                        <div
                          className="flex h-16 items-center justify-center text-xl"
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
                          <div className="truncate text-[11px] font-semibold text-gray-800">
                            {p.name}
                          </div>
                          <div className="text-[10px] font-bold" style={{ color: theme }}>
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
              className="rounded-xl px-3 py-2 text-center text-xs font-semibold text-white"
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
