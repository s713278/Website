import { cn } from '@/shared/lib/utils';
import { WishlistButton } from '@/features/storefront/components/WishlistButton';
import type { StoreProduct } from '@/features/storefront/types';

type ProductGalleryProps = {
  product: StoreProduct;
  imageIdx: number;
  onImageIdx: (idx: number) => void;
};

export function ProductGallery({ product, imageIdx, onImageIdx }: ProductGalleryProps) {
  const gallery = product.images.length ? product.images : product.image ? [product.image] : [];

  return (
    <div className="space-y-3">
      <div
        className="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-border"
        style={{ backgroundColor: product.color || 'var(--store-theme-soft)' }}
      >
        {gallery[imageIdx] ? (
          <img src={gallery[imageIdx]} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-7xl" aria-hidden>
            {product.icon}
          </span>
        )}
        <WishlistButton productId={product.id} className="absolute right-3 top-3" />
      </div>
      {gallery.length > 1 && (
        <div className="flex gap-2">
          {gallery.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => onImageIdx(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                'h-16 w-16 overflow-hidden rounded-xl border-2',
                i === imageIdx ? 'border-[var(--store-theme)]' : 'border-transparent',
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
