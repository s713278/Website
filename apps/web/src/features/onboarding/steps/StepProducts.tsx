import { useRef } from 'react';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { readImageFileAsDataUrl } from '@/shared/lib/read-image-file';
import { cn } from '@/shared/lib/utils';

export function StepProducts() {
  const categories = useOnboardingStore((s) => s.categories);
  const products = useOnboardingStore((s) => s.products);
  const expanded = useOnboardingStore((s) => s.expandedProductCatId);
  const setExpanded = useOnboardingStore((s) => s.setExpandedProductCat);
  const addProduct = useOnboardingStore((s) => s.addProduct);
  const updateProduct = useOnboardingStore((s) => s.updateProduct);
  const removeProduct = useOnboardingStore((s) => s.removeProduct);
  const error = useOnboardingStore((s) => s.error);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingPhotoId = useRef<string | null>(null);

  return (
    <StepShell
      title="Add Products"
      description="Open a category, name a few items, tap the icon to add a photo. You can finish the rest later."
      error={error}
      footer={<StepNav />}
    >
      <p
        className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        aria-label="Product photo guidelines"
      >
        <span aria-hidden>📷</span>
        Photo tip: square <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold">1:1</span>,
        ideally <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold">800×800</span>,
        JPG/PNG under <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold">5 MB</span>
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const id = pendingPhotoId.current;
          e.target.value = '';
          if (!file || !id) return;
          void readImageFileAsDataUrl(file).then((dataUrl) => {
            if (dataUrl) updateProduct(id, { imageDataUrl: dataUrl });
          });
        }}
      />

      {!categories.length ? (
        <p className="py-6 text-center text-sm text-amber-600">
          Select categories in the previous step to add products.
        </p>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const open = expanded === cat.id;
            const catProducts = products.filter((p) => p.categoryId === cat.id);
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
                  <div className="space-y-3 p-4">
                    {catProducts.map((p) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`Add photo for ${p.name || 'product'}`}
                          className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200',
                          )}
                          style={{ background: p.color }}
                          onClick={() => {
                            pendingPhotoId.current = p.id;
                            fileRef.current?.click();
                          }}
                        >
                          {p.imageDataUrl ? (
                            <img src={p.imageDataUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span aria-hidden>📷</span>
                          )}
                        </button>
                        <input
                          type="text"
                          value={p.name}
                          placeholder="Product name"
                          aria-label="Product name"
                          onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <button
                          type="button"
                          aria-label="Remove product"
                          className="text-sm text-red-500 hover:underline"
                          onClick={() => removeProduct(p.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-sm font-medium text-emerald-700 hover:underline"
                      onClick={() => addProduct(cat.id)}
                    >
                      + Add product
                    </button>
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
