import { useState } from 'react';
import { formatMoney, minPrice } from '@mithra/domain';
import { useStore } from '../home/store-context';
import { SkuControls } from '../product/SkuControls';

export function MenuView() {
  const { draft, activeCategory, setActiveCategory, setProductId, setView } = useStore();
  const [q, setQ] = useState('');

  const products = draft.products
    .filter((p) => (activeCategory === 'all' ? true : p.categoryId === activeCategory))
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex min-h-[70vh]">
      <nav className="w-24 shrink-0 border-r border-slate-100 bg-slate-50 p-2">
        <button
          type="button"
          className={`mb-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold ${
            activeCategory === 'all' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'
          }`}
          onClick={() => setActiveCategory('all')}
        >
          All
        </button>
        {draft.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`mb-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold ${
              activeCategory === c.id ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => setActiveCategory(c.id)}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </nav>
      <div className="flex-1 p-3">
        <input
          className="md-field mb-3"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search products"
        />
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-100 p-3">
              <button
                type="button"
                className="mb-2 text-left"
                onClick={() => {
                  setProductId(p.id);
                  setView('product');
                }}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">From {formatMoney(minPrice(p))}</div>
              </button>
              <SkuControls product={p} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
