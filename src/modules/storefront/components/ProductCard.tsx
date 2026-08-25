import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductCartControl } from '@/modules/storefront/components/ProductCartControl'
import { VariantPicker } from '@/modules/storefront/components/VariantPicker'
import { useSelectedVariant } from '@/modules/storefront/hooks/useSelectedVariant'
import { storeProductPath } from '@/modules/storefront/lib/store-paths'
import type { Product } from '@/modules/storefront/types'
import { formatCurrency } from '@/shared/lib/utils'

type ProductCardProps = {
  storeId: string
  storeName: string
  product: Product
  className?: string
}

export function ProductCard({ storeId, storeName, product, className }: ProductCardProps) {
  const productHref = storeProductPath(storeId, product.id)
  const { variants, selected, selectedId, setSelectedId, multi } = useSelectedVariant(product)
  const [saved, setSaved] = useState(false)

  return (
    <article
      className={cn(
        'store-product-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] transition duration-200 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)]',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <Link to={productHref} className="block size-full">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-slate-50 text-4xl">🥒</div>
          )}
        </Link>
        <ProductCartControl
          storeId={storeId}
          storeName={storeName}
          product={product}
          variant={selected}
          className="absolute bottom-2.5 right-2.5 z-10"
        />
      </div>

      <button
        type="button"
        onClick={() => setSaved((v) => !v)}
        className={cn(
          'absolute right-2.5 top-2.5 z-10 inline-flex size-9 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-500 shadow-sm transition hover:text-slate-800',
          saved && 'border-rose-200 text-rose-500',
        )}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={saved}
      >
        <Heart className={cn('size-4', saved && 'fill-current')} strokeWidth={1.75} />
      </button>

      <div className="flex flex-1 flex-col px-3.5 pb-4 pt-3 sm:px-4">
        <Link
          to={productHref}
          className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 transition hover:text-[var(--store-theme,var(--md-green-700))]"
        >
          {product.name}
        </Link>

        {multi ? (
          <div className="mt-2.5" onClick={(e) => e.preventDefault()}>
            <VariantPicker
              variants={variants}
              selectedId={selectedId}
              onSelect={setSelectedId}
              label="Size"
            />
          </div>
        ) : selected.unit ? (
          <p className="mt-1.5 text-xs font-medium text-slate-500">{selected.unit}</p>
        ) : null}

        <p className="mt-2 text-sm font-bold leading-none text-[var(--store-theme,var(--md-green-600))]">
          {formatCurrency(selected.price)}
        </p>

        {product.rating != null ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-600">
            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
            <span className="font-semibold text-slate-800">{product.rating.toFixed(1)}</span>
          </p>
        ) : null}
      </div>
    </article>
  )
}
