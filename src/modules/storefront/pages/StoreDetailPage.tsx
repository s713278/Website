import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CategoryBrowseSection,
  CategoryScroller,
  OfferBanner,
  ProductGrid,
  ServiceInfoBar,
  StoreAboutSection,
  StoreCartBar,
  StorePageFooter,
  StorePageStates,
  StorefrontHeader,
} from '@/modules/storefront/components'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { useStoreProducts } from '@/modules/storefront/hooks/useStoreProducts'
import { useStoreSkuSearch } from '@/modules/storefront/hooks/useStoreSkuSearch'
import {
  ALL_CATEGORY,
  buildCategories,
  categoryLabel,
  resolveCategoryFilter,
  type CategoryFilter,
} from '@/modules/storefront/lib/catalog-filters'
import { listCachedStoreProducts } from '@/modules/storefront/lib/product-catalog-cache'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Store } from '@/modules/storefront/types'
import { SearchField } from '@/shared/components'
import { useSearchQueryParam } from '@/shared/hooks/useSearchQueryParam'
import { isLiveApi } from '@/shared/api'
import { isSearchActive, isSearchTooShort, searchUiMinChars } from '@/shared/lib/search-query'
import { syncVendorCart } from '../lib/cart-actions'
import { StoreSubscriptionNotice } from '@/modules/storefront/components/StoreSubscriptionNotice'
import { isStoreClosedForSubscription } from '@/modules/storefront/lib/store-subscription'
import { useAuthStore } from '@/shared/auth/store/auth-store'

const SEARCH_DEBOUNCE_MS = 250

export function StoreDetailPage() {
  const { storeId = 'r1' } = useParams()
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const { store, loading, error, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })

  return (
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading store…"
      loadingLayout="home"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref="/stores/r1"
      backLabel="Open demo store"
    >
      {store && isStoreClosedForSubscription(store.subscriptionStatus) ? (
        <StoreSubscriptionNotice store={store} />
      ) : store ? (
        <StoreHome store={store} itemCount={itemCount} />
      ) : null}
    </StorePageStates>
  )
}

type StoreHomeProps = {
  store: Store
  itemCount: number
}

function StoreHome({ store, itemCount }: StoreHomeProps) {
  const { query, setQuery, searchRequested } = useSearchQueryParam()
  const [searchDraft, setSearchDraft] = useState(query)
  const [searchOpen, setSearchOpen] = useState(Boolean(query.trim()) || searchRequested)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(ALL_CATEGORY)
  const [browseOpen, setBrowseOpen] = useState(Boolean(query.trim()) || searchRequested)
  const cartSubtotal = useCartStore((s) => s.subtotal(store.id))
  const productsRef = useRef<HTMLElement>(null)

  const homePageSize = 6
  const browsePageSize = 10

  const products = useStoreProducts(store.id, {
    pageSize: browseOpen ? browsePageSize : homePageSize,
    categoryFilter,
  })

  // Re-read on each render when products update — cache lives outside React state.
  const cachedProducts = listCachedStoreProducts(store.id)
  const categories = buildCategories(store, cachedProducts)

  const draftTrimmed = searchDraft.trim()
  const minChars = searchUiMinChars(isLiveApi())
  const searchTooShort = isSearchTooShort(searchDraft, minChars)
  const searchNeedle = isSearchActive(searchDraft, minChars) ? draftTrimmed : ''
  const searching = Boolean(searchNeedle)
  const skuSearch = useStoreSkuSearch(store.id, searchNeedle)

  const browseProducts = searching ? skuSearch.items : products.items

  useEffect(() => {
    setSearchDraft(query)
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft.trim() === query) return
      setQuery(searchDraft)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchDraft, query, setQuery])

  useEffect(() => {
    if (!query.trim() && !searchRequested) return
    setSearchOpen(true)
    setBrowseOpen(true)
  }, [query, searchRequested])

  const user = useAuthStore((s) => s.user)
  const hydratedRef = useRef(false)
  const hydratedUserId = useRef(user?.id)

  // Once per identity — server cart replaces leftover local names from the last session.
  useEffect(() => {
    if (hydratedUserId.current !== user?.id) {
      hydratedRef.current = false
      hydratedUserId.current = user?.id
    }
    if (user?.role !== 'customer') return
    if (hydratedRef.current) return
    hydratedRef.current = true
    void syncVendorCart(store.id, store.name, listCachedStoreProducts(store.id)).catch(() => {})
  }, [store.id, store.name, user?.id, user?.role])

  function selectCategory(next: CategoryFilter) {
    setCategoryFilter(resolveCategoryFilter(categories, next))
  }

  useEffect(() => {
    const resolved = resolveCategoryFilter(categories, categoryFilter)
    if (resolved !== categoryFilter) setCategoryFilter(resolved)
  }, [categories, categoryFilter])

  useEffect(() => {
    if (browseOpen) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [browseOpen])

  function scrollToProducts() {
    productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function closeSearch() {
    setSearchOpen(false)
    setBrowseOpen(false)
    setCategoryFilter(ALL_CATEGORY)
    setSearchDraft('')
    setQuery('')
  }

  function handleToggleSearch() {
    if (searchOpen) {
      closeSearch()
      return
    }
    setCategoryFilter(ALL_CATEGORY)
    setBrowseOpen(true)
    setSearchOpen(true)
  }

  function openBrowse(next: CategoryFilter = ALL_CATEGORY) {
    selectCategory(next)
    setBrowseOpen(true)
  }

  const showHomeViewAll =
    !browseOpen &&
    (!products.lastPage || products.totalElements > products.items.length)

  return (
    <>
      <StorefrontHeader
        store={store}
        cartCount={itemCount}
        searchOpen={searchOpen}
        onToggleSearch={handleToggleSearch}
      />

      {searchOpen ? (
        <div className="border-b border-slate-100 bg-white py-4">
          <div className="store-shell-inner">
            <SearchField
              value={searchDraft}
              onChange={setSearchDraft}
              placeholder="Search pickles, combos, gifts…"
              aria-label="Search products"
              autoFocus
              minChars={minChars}
            />
          </div>
        </div>
      ) : null}

      <main
        className={`store-shell-inner flex flex-1 flex-col gap-5 py-5 sm:gap-6 sm:py-6${
          itemCount > 0 ? ' pb-24' : ''
        }`}
      >
        {browseOpen ? (
          (searching ? skuSearch.error : products.error) &&
          browseProducts.length === 0 &&
          !(searching ? skuSearch.loading : products.loading) ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-5 text-sm text-red-700">
              <p className="font-medium">{searching ? skuSearch.error : products.error}</p>
              {!searching ? (
                <button
                  type="button"
                  onClick={() => products.reload()}
                  className="mt-3 inline-flex rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : (
            <CategoryBrowseSection
              storeId={store.id}
              storeName={store.name}
              categories={categories}
              products={browseProducts}
              categoryFilter={categoryFilter}
              query={searchDraft}
              searching={searching}
              searchTooShort={searchTooShort}
              onCategoryChange={selectCategory}
              hasMore={searching ? false : !products.lastPage}
              loading={searching ? skuSearch.loading : products.loading}
              loadingMore={!searching && products.loadingMore}
              onLoadMore={searching ? undefined : products.loadMore}
            />
          )
        ) : (
          <>
            <div className="flex flex-col gap-5 sm:gap-6">
              <OfferBanner
                title={store.name}
                tagline={store.tagline}
                location={store.location}
                heroImage={store.heroImage}
                badges={store.heroBadges}
                onShopNow={scrollToProducts}
              />
              <ServiceInfoBar
                storeId={store.id}
                trustStrip={store.trustStrip}
                fulfillment={store.fulfillment}
              />
              {store.description ? (
                <StoreAboutSection storeName={store.name} description={store.description} />
              ) : null}
            </div>

            <div>
              <CategoryScroller
                categories={categories}
                activeFilter={categoryFilter}
                showAllOption
                onSelect={(filter) => {
                  selectCategory(filter)
                  scrollToProducts()
                }}
                onViewAll={() => openBrowse(ALL_CATEGORY)}
                actionLabel="View all"
              />
            </div>

            <section ref={productsRef}>
              {products.error && products.items.length === 0 && !products.loading ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-5 text-sm text-red-700">
                  <p className="font-medium">{products.error}</p>
                  <button
                    type="button"
                    onClick={() => products.reload()}
                    className="mt-3 inline-flex rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <ProductGrid
                  storeId={store.id}
                  storeName={store.name}
                  title={categoryLabel(categories, categoryFilter)}
                  products={products.items}
                  loading={products.loading}
                  skeletonCount={homePageSize}
                  actionLabel="View all"
                  onAction={showHomeViewAll ? () => openBrowse(categoryFilter) : undefined}
                  emptyTitle="No products match"
                  emptyDescription="No items in this category yet."
                />
              )}
            </section>
          </>
        )}
      </main>

      <StorePageFooter store={store} />
      <StoreCartBar storeId={store.id} itemCount={itemCount} subtotal={cartSubtotal} />
    </>
  )
}
