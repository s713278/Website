import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Leaf, ShieldCheck, ShoppingCart, Sparkles, Star } from 'lucide-react'
import { loginPathForRole } from '@/app/router/role-home'
import { ProductGallery } from './ProductGallery'
import { StorePageFooter } from './StorePageFooter'
import { StorefrontHeader } from './StorefrontHeader'
import { VariantPicker } from './VariantPicker'
import { useSelectedVariant } from '@/modules/storefront/hooks/useSelectedVariant'
import {
  formatPricePerKg,
  getProductImages,
  hasMultipleVariants,
} from '@/modules/storefront/lib/product-variants'
import { storeCartPath, storeCheckoutPath } from '@/modules/storefront/lib/store-paths'
import type { Product, ProductVariant, Store } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, QuantityStepper } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

const TRUST_BADGES = [
  { icon: Leaf, label: '100% Natural' },
  { icon: Sparkles, label: 'No Preservatives' },
  { icon: ShieldCheck, label: 'FSSAI Licensed' },
] as const

type ProductDetailPanelProps = {
  store: Store
  product: Product
  cartCount: number
  onAdd: (variant: ProductVariant, qty: number) => void
  onBack: () => void
  onSearch: () => void
}

export function ProductDetailPanel({
  store,
  product,
  cartCount,
  onAdd,
  onBack,
  onSearch,
}: ProductDetailPanelProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const images = useMemo(() => getProductImages(product), [product])
  const { variants, selected, selectedId, setSelectedId } = useSelectedVariant(product)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    setQty(1)
  }, [product.id])

  const perKg = formatPricePerKg(selected.price, selected.unit)
  const inStock = product.inStock !== false
  const spice = product.spiceLevel ?? (product.veg ? 'Mild Spicy' : 'Medium Spicy')
  const reviewCount = product.reviewCount ?? (product.rating ? 120 : 0)

  function handleBuyNow() {
    onAdd(selected, qty)
    const checkoutPath = storeCheckoutPath(store.id)
    if (user?.role === 'customer') {
      navigate(checkoutPath)
      return
    }
    navigate(loginPathForRole('customer'), { state: { from: checkoutPath } })
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

      <main className="store-shell-inner flex-1 overflow-visible py-4 sm:py-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <ProductGallery images={images} alt={product.name} />

          <div className="flex min-w-0 flex-col overflow-visible">
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {product.name}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {selected.unit}
              {spice ? ` · ${spice}` : ''}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              {product.description}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {product.rating != null ? (
                <p className="inline-flex items-center gap-1 text-sm text-slate-700">
                  <Star
                    className="size-4 fill-[var(--store-accent,#f97316)] text-[var(--store-accent,#f97316)]"
                    aria-hidden
                  />
                  <span className="font-semibold text-slate-900">{product.rating.toFixed(1)}</span>
                  {reviewCount ? (
                    <span className="text-slate-500">({reviewCount} reviews)</span>
                  ) : null}
                </p>
              ) : null}
              {inStock ? (
                <span className="rounded-full bg-[var(--store-accent-soft,rgba(249,115,22,0.16))] px-2.5 py-1 text-xs font-semibold text-[var(--store-accent,#ea580c)] ring-1 ring-[var(--store-accent-muted,rgba(249,115,22,0.28))]">
                  In Stock
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              <p className="text-2xl font-bold text-slate-900 sm:text-[1.75rem]">
                {formatCurrency(selected.price)}
              </p>
              {perKg ? <p className="mt-1 text-sm text-slate-500">{perKg}</p> : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <Icon className="size-3.5 text-emerald-600" aria-hidden />
                  {label}
                </span>
              ))}
            </div>

            {hasMultipleVariants(product) ? (
              <VariantPicker
                variants={variants}
                selectedId={selectedId}
                onSelect={setSelectedId}
                label="Select Pack Size"
                tone="solid"
                className="mt-5"
              />
            ) : null}

            <QuantityStepper value={qty} onChange={setQty} className="mt-4 w-fit" />

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button
                size="sm"
                className="h-9 rounded-lg bg-[var(--store-theme,var(--md-green-800))] px-4 text-sm text-white hover:bg-[var(--store-theme,var(--md-green-900))]"
                onClick={() => onAdd(selected, qty)}
                disabled={!inStock}
              >
                <ShoppingCart className="size-3.5" aria-hidden />
                Add to Cart
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-lg border-[var(--store-theme,var(--md-green-800))] px-4 text-sm text-[var(--store-theme,var(--md-green-800))]"
                onClick={handleBuyNow}
                disabled={!inStock}
              >
                Buy Now
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
      </main>

      <StorePageFooter store={store} />
    </>
  )
}
