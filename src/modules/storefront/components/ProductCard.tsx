import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardVariantPicker } from '@/modules/storefront/components/CardVariantPicker'
import { ProductCartControl } from '@/modules/storefront/components/ProductCartControl'
import { ProductPrice } from '@/modules/storefront/components/ProductPrice'
import { useSelectedVariant } from '@/modules/storefront/hooks/useSelectedVariant'
import { useProductVariantCartState } from '@/modules/storefront/lib/cart-write-pending'
import { storeProductPath } from '@/modules/storefront/lib/store-paths'
import type { Product } from '@/modules/storefront/types'
type ProductCardProps = {
  storeId: string
  storeName: string
  product: Product
  className?: string
}

export function ProductCard({ storeId, storeName, product, className }: ProductCardProps) {
  const { variants, selected, selectedId, setSelectedId, multi } = useSelectedVariant(
    product,
    storeId,
  )
  const productHref = storeProductPath(storeId, product.id, selected.id)
  const { isPending } = useProductVariantCartState(storeId, product.id)

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
          <ProductPrice
            price={selected.price}
            listPrice={selected.listPrice}
            size="sm"
            className="shrink-0 flex-col items-end gap-0"
            saleClassName="text-[15px] leading-tight text-[var(--store-accent,#ea580c)] sm:text-base"
          />
        </div>

        {multi ? (
          <CardVariantPicker
            variants={variants}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isPending={isPending}
            className="mt-2.5"
          />
        ) : null}
      </div>
    </article>
  )
}
