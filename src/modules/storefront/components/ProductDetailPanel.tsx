import { useMemo } from 'react'
import { Star } from 'lucide-react'
import { ProductCartControl } from './ProductCartControl'
import { ProductGallery } from './ProductGallery'
import { ProductPrice } from './ProductPrice'
import { resolveTrustIcon } from '@/modules/storefront/lib/trust-icons'
import { StoreCartBar } from './StoreCartBar'
import { StorePageFooter } from './StorePageFooter'
import { StorefrontHeader } from './StorefrontHeader'
import { VariantPicker } from './VariantPicker'
import { useSelectedVariant } from '@/modules/storefront/hooks/useSelectedVariant'
import { useProductVariantCartState } from '@/modules/storefront/lib/cart-write-pending'
import { getProductImages, hasMultipleVariants } from '@/modules/storefront/lib/product-variants'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product, Store } from '@/modules/storefront/types'
import { Button } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

type ProductDetailPanelProps = {
  store: Store
  product: Product
  cartCount: number
  onBack: () => void
  onSearch: () => void
}

/**
 * PDP from live SKU detail only — no marketing placeholders.
 * Cart = ProductCartControl (same as cards).
 */
export function ProductDetailPanel({
  store,
  product,
  cartCount,
  onBack,
  onSearch,
}: ProductDetailPanelProps) {
  const cartSubtotal = useCartStore((s) => s.subtotal(store.id))
  const images = useMemo(() => getProductImages(product), [product])
  const { variants, selected, selectedId, setSelectedId } = useSelectedVariant(product, store.id)
  const { isPending } = useProductVariantCartState(store.id, product.id)

  // Live PDP: API `is_active` → product.inStock / variant.active
  const inStock = selected.active !== false && product.inStock !== false

  return (
    <>
      <StorefrontHeader
        storeName={store.name}
        logoUrl={store.theme?.logoImage}
        cartCount={cartCount}
        cartHref={storeCartPath(store.id)}
        searchOpen={false}
        onToggleSearch={onSearch}
        pageTitle={product.name}
        onBack={onBack}
      />

      <main
        className={`store-shell-inner flex-1 overflow-visible py-4 sm:py-5${
          cartCount > 0 ? ' pb-24' : ''
        }`}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <ProductGallery images={images} alt={product.name} />

          <div className="flex min-w-0 flex-col overflow-visible">
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {product.name}
            </h1>

            {product.description ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                {product.description}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {product.rating != null ? (
                <p className="inline-flex items-center gap-1 text-sm text-slate-700">
                  <Star
                    className="size-4 fill-[var(--store-accent,#f97316)] text-[var(--store-accent,#f97316)]"
                    aria-hidden
                  />
                  <span className="font-semibold text-slate-900">{product.rating.toFixed(1)}</span>
                  {product.reviewCount != null ? (
                    <span className="text-slate-500">({product.reviewCount} reviews)</span>
                  ) : null}
                </p>
              ) : null}
              <span
                className={
                  inStock
                    ? 'rounded-full bg-[var(--store-accent-soft,rgba(249,115,22,0.16))] px-2.5 py-1 text-xs font-semibold text-[var(--store-accent,#ea580c)] ring-1 ring-[var(--store-accent-muted,rgba(249,115,22,0.28))]'
                    : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500'
                }
              >
                {inStock ? 'In Stock' : 'Out of stock'}
              </span>
              {selected.onSale ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  On sale
                  {selected.discount != null && selected.discount > 0
                    ? ` · ${formatCurrency(selected.discount)} off`
                    : ''}
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              <ProductPrice price={selected.price} listPrice={selected.listPrice} size="lg" />
            </div>

            {store.trustStrip && store.trustStrip.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
                {store.trustStrip.map((item) => {
                  const Icon = resolveTrustIcon(item.icon)
                  return (
                    <span
                      key={`${item.title}-${item.subtitle}`}
                      className="inline-flex items-center gap-1.5"
                      title={item.subtitle || undefined}
                    >
                      <Icon className="size-3.5 text-emerald-600" aria-hidden />
                      {item.title}
                    </span>
                  )
                })}
              </div>
            ) : null}

            {hasMultipleVariants(product) ? (
              <VariantPicker
                variants={variants}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isPending={isPending}
                label="Select Pack Size"
                tone="solid"
                className="mt-5"
              />
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {inStock ? (
                <ProductCartControl
                  storeId={store.id}
                  storeName={store.name}
                  product={product}
                  variant={selected}
                  className="h-11 min-h-11 min-w-[6.5rem] sm:h-9 sm:min-h-9"
                />
              ) : (
                <Button size="sm" disabled className="h-11 min-h-11 rounded-lg sm:h-9 sm:min-h-9">
                  Out of stock
                </Button>
              )}
            </div>
          </div>
        </div>

        {product.ingredients ? (
          <section className="mt-7 border-t border-slate-100 pt-6 sm:mt-8">
            <h2 className="text-base font-bold text-slate-900">Ingredients</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              {product.ingredients}
            </p>
          </section>
        ) : null}

        {product.spiceLevel ? (
          <p className="mt-4 text-sm text-slate-500">Spice: {product.spiceLevel}</p>
        ) : null}
      </main>

      <StorePageFooter store={store} />
      <StoreCartBar storeId={store.id} itemCount={cartCount} subtotal={cartSubtotal} />
    </>
  )
}
