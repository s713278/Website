import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Star } from 'lucide-react'
import { ProductCartControl } from './ProductCartControl'
import { ProductGallery } from './ProductGallery'
import { resolveTrustIcon } from '@/modules/storefront/lib/trust-icons'
import { StoreCartBar } from './StoreCartBar'
import { StorePageFooter } from './StorePageFooter'
import { StorefrontHeader } from './StorefrontHeader'
import { VariantPicker } from './VariantPicker'
import { useSelectedVariant } from '@/modules/storefront/hooks/useSelectedVariant'
import { requestAddToCart } from '@/modules/storefront/lib/request-add-to-cart'
import {
  formatPricePerKg,
  getProductImages,
  hasMultipleVariants,
  variantCartId,
} from '@/modules/storefront/lib/product-variants'
import { storeCartPath, storeCheckoutPath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product, Store } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'
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
 * Cart = ProductCartControl (same as cards). Buy Now adds only if missing.
 */
export function ProductDetailPanel({
  store,
  product,
  cartCount,
  onBack,
  onSearch,
}: ProductDetailPanelProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const cartSubtotal = useCartStore((s) => s.subtotal(store.id))
  const images = useMemo(() => getProductImages(product), [product])
  const { variants, selected, selectedId, setSelectedId } = useSelectedVariant(product, store.id)
  const [buyPending, setBuyPending] = useState(false)

  const lineId = variantCartId(product.id, selected.id)
  const inCart = useCartStore((s) => Boolean(s.findLine(store.id, lineId)))

  const perKg = formatPricePerKg(selected.price, selected.unit)
  // Live PDP: API `is_active` → product.inStock / variant.active
  const inStock = selected.active !== false && product.inStock !== false
  const listPrice = selected.listPrice
  const showListPrice =
    listPrice != null && Number.isFinite(listPrice) && listPrice > selected.price
  const checkoutPath = storeCheckoutPath(store.id)

  async function handleBuyNow() {
    if (buyPending || !inStock) return
    setBuyPending(true)
    try {
      if (!inCart) {
        const added = await requestAddToCart({
          user,
          navigate,
          storeId: store.id,
          storeName: store.name,
          product,
          variant: selected,
          qty: 1,
          returnTo: checkoutPath,
          onError: (message) => window.alert(message),
        })
        if (!added) return
      }
      navigate(checkoutPath)
    } finally {
      setBuyPending(false)
    }
  }

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

            {selected.unit ? (
              <p className="mt-1.5 text-sm text-slate-500">{selected.unit}</p>
            ) : null}

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
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-900 sm:text-[1.75rem]">
                  {formatCurrency(selected.price)}
                </p>
                {showListPrice ? (
                  <p className="text-sm text-slate-400 line-through">
                    {formatCurrency(listPrice)}
                  </p>
                ) : null}
              </div>
              {perKg ? <p className="mt-1 text-sm text-slate-500">{perKg}</p> : null}
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
                onSelect={(id) => {
                  if (buyPending) return
                  setSelectedId(id)
                }}
                label="Select Pack Size"
                tone="solid"
                className={`mt-5${buyPending ? ' pointer-events-none opacity-60' : ''}`}
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
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-h-11 min-w-[7.5rem] rounded-lg border-[var(--store-theme,var(--md-green-800))] px-5 text-sm text-[var(--store-theme,var(--md-green-800))] sm:h-9 sm:min-h-9 sm:px-4"
                onClick={() => {
                  void handleBuyNow()
                }}
                disabled={!inStock || buyPending}
                aria-busy={buyPending}
              >
                {buyPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Please wait…
                  </>
                ) : (
                  'Buy Now'
                )}
              </Button>
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
