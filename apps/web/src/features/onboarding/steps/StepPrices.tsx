import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepPrices() {
  const categories = useOnboardingStore((s) => s.categories);
  const products = useOnboardingStore((s) => s.products);
  const expanded = useOnboardingStore((s) => s.expandedSkuCatId);
  const setExpanded = useOnboardingStore((s) => s.setExpandedSkuCat);
  const addVariant = useOnboardingStore((s) => s.addVariant);
  const updateVariant = useOnboardingStore((s) => s.updateVariant);
  const removeVariant = useOnboardingStore((s) => s.removeVariant);
  const error = useOnboardingStore((s) => s.error);

  return (
    <StepShell
      title="Set Prices"
      description="Open a category and set size + price. One size is enough to go live."
      error={error}
      footer={<StepNav />}
    >
      {!categories.length ? (
        <p className="py-6 text-center text-sm text-amber-600">Add products first.</p>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const open = expanded === cat.id;
            const catProducts = products.filter(
              (p) => p.categoryId === cat.id && p.name.trim(),
            );
            return (
              <div key={cat.id} className="overflow-hidden rounded-2xl border border-gray-200">
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left font-semibold text-gray-800"
                  onClick={() => setExpanded(open ? null : cat.id)}
                >
                  <span>
                    {cat.name}{' '}
                    <span className="font-normal text-gray-500">({catProducts.length})</span>
                  </span>
                  <span aria-hidden>{open ? '▾' : '▸'}</span>
                </button>
                {open ? (
                  <div className="space-y-4 p-4">
                    {catProducts.map((p) => (
                      <div key={p.id} className="rounded-xl border border-gray-100 p-3">
                        <div className="mb-2 font-medium text-gray-800">{p.name}</div>
                        <div className="space-y-2">
                          {p.variants.map((v) => (
                            <div key={v.id} className="flex flex-wrap items-center gap-2">
                              <label className="sr-only" htmlFor={`size-${v.id}`}>
                                Size for {p.name}
                              </label>
                              <input
                                id={`size-${v.id}`}
                                type="text"
                                value={v.label}
                                placeholder="Size"
                                onChange={(e) =>
                                  updateVariant(p.id, v.id, { label: e.target.value })
                                }
                                className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              />
                              <label className="sr-only" htmlFor={`price-${v.id}`}>
                                Price for {p.name}
                              </label>
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-gray-500">₹</span>
                                <input
                                  id={`price-${v.id}`}
                                  type="number"
                                  min={0}
                                  value={v.price || ''}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateVariant(p.id, v.id, {
                                      price: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                />
                              </div>
                              {p.variants.length > 1 ? (
                                <button
                                  type="button"
                                  className="text-xs text-red-500"
                                  onClick={() => removeVariant(p.id, v.id)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
                          onClick={() => addVariant(p.id)}
                        >
                          + Add size
                        </button>
                      </div>
                    ))}
                    {!catProducts.length ? (
                      <p className="text-sm text-gray-500">No named products in this category yet.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </StepShell>
  );
}
