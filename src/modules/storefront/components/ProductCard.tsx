import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardVariantPicker } from '@/modules/storefront/components/CardVariantPicker'
import { ProductCartControl } from '@/modules/storefront/components/ProductCartControl'
import { useSelectedVariant } from '@/modules/storefront/hooks/useSelectedVariant'
import { formatProductPriceRange, hasDistinctPriceRange } from '@/modules/storefront/lib/product-price'
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

  return (
    <article
      className={cn(
        'store-product-card group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white',
        className,
      )}
      style={{
        border: 'var(--store-card-border, 1px solid rgb(226 232 240 / 0.9))',
        boxShadow: 'var(--store-card-shadow, none)',
      }}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-slate-50">
        <Link to={productHref} className="block size-full">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-slate-300">
              <Package className="size-12" strokeWidth={1.25} aria-hidden />
            </div>
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

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={productHref}
            className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 transition hover:text-[var(--store-theme,var(--md-green-700))] sm:text-[15px]"
          >
            {product.name}
          </Link>
          <p
            className="shrink-0 text-right text-[15px] font-bold leading-tight text-[var(--store-accent,#ea580c)] sm:text-base"
            aria-label={`Price ${formatCurrency(selected.price)}`}
          >
            {formatCurrency(selected.price)}
          </p>
        </div>

        <div className="mt-1">
          {multi && hasDistinctPriceRange(product) ? (
            <p className="text-[13px] font-bold leading-tight text-[var(--store-accent,#ea580c)]/90 sm:text-[15px]">
              {formatProductPriceRange(product)}
            </p>
          ) : !multi && selected.unit ? (
            <p className="text-[11px] font-medium leading-none text-slate-500">{selected.unit}</p>
          ) : null}
        </div>

        {multi ? (
          <CardVariantPicker
            variants={variants}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="mt-2.5"
          />
        ) : null}
      </div>
    </article>
  )
}
