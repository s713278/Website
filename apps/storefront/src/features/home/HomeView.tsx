import { formatMoney, minPrice } from '@mithra/domain';
import { useStore } from './store-context';

export function HomeView() {
  const { draft, setView, setActiveCategory, setProductId } = useStore();
  const popular = draft.products.filter((p) => p.popular);

  return (
    <div>
      <section className="store-hero">
        {draft.settings.banner ? <img src={draft.settings.banner} alt="" /> : null}
        <div className="store-hero-overlay" />
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">100% Homemade</span>
        <h1 className="md-display mt-2 text-3xl">{draft.settings.storeName}</h1>
        <p className="mt-1 text-sm text-white/90">{draft.settings.tagline}</p>
        <p className="mt-1 text-xs text-white/75">{draft.settings.location}</p>
      </section>

      <div className="space-y-6 p-4">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="md-display text-lg">Categories</h2>
            <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => setView('menu')}>
              View menu
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {draft.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="min-w-[4.5rem] rounded-xl border border-slate-100 bg-white p-2 text-center shadow-[var(--shadow-sm)]"
                onClick={() => {
                  setActiveCategory(c.id);
                  setView('menu');
                }}
              >
                <div className="text-xl">{c.icon || '🍽️'}</div>
                <div className="mt-1 text-[11px] font-semibold">{c.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="md-display text-lg">Popular Products</h2>
            <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => setView('menu')}>
              View all
            </button>
          </div>
          <div className="product-grid">
            {popular.map((p) => (
              <button
                key={p.id}
                type="button"
                className="product-card"
                onClick={() => {
                  setProductId(p.id);
                  setView('product');
                }}
              >
                <div className="flex h-24 items-center justify-center" style={{ background: p.color || '#ecfdf5' }}>
                  {p.image ? <img src={p.image} alt="" className="h-16 w-16 rounded-full object-cover" /> : null}
                </div>
                <div className="p-2.5">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">From {formatMoney(minPrice(p))}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          Powered by MithraDirect · This is a WhatsApp Order storefront
        </p>
      </div>
    </div>
  );
}
