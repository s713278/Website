import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useStoreScrollNav } from '@/modules/storefront/hooks/useStoreScrollNav'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { useStoreProducts } from '@/modules/storefront/hooks/useStoreProducts'
import {
  ALL_CATEGORY,
  buildCategories,
  categoryLabel,
  filterProducts,
  resolveCategoryFilter,
  type CategoryFilter,
} from '@/modules/storefront/lib/catalog-filters'
import { listCachedStoreProducts } from '@/modules/storefront/lib/product-catalog-cache'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Store } from '@/modules/storefront/types'
import { SearchField } from '@/shared/components'
import { useSearchQueryParam } from '@/shared/hooks/useSearchQueryParam'

const SEARCH_MIN_CHARS = 2
const SEARCH_DEBOUNCE_MS = 250

export function StoreDetailPage() {
  const { storeId = 'r1' } = useParams()
  const itemCount = useCartStore((s) => s.itemCount(storeId))
  const { store, loading, error, wrapperRef } = useStorePage(storeId)

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
      {store ? <StoreHome store={store} itemCount={itemCount} /> : null}
    </StorePageStates>
  )
}

type StoreHomeProps = {
  store: Store
  itemCount: number
}

function StoreHome({ store, itemCount }: StoreHomeProps) {
  const { query, setQuery } = useSearchQueryParam()
  const [searchDraft, setSearchDraft] = useState(query)
  const [searchOpen, setSearchOpen] = useState(Boolean(query.trim()))
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(ALL_CATEGORY)
  const [browseOpen, setBrowseOpen] = useState(Boolean(query.trim()))
  const cartSubtotal = useCartStore((s) => s.subtotal(store.id))
  const homeRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLElement>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)

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
  const searchTooShort = draftTrimmed.length > 0 && draftTrimmed.length < SEARCH_MIN_CHARS
  const searchNeedle = draftTrimmed.length >= SEARCH_MIN_CHARS ? draftTrimmed : ''
  const searching = Boolean(searchNeedle)

  /** Search filters the session cache only — never triggers a products API replace. */
  const browseProducts = useMemo(() => {
    if (!searching) return products.items
    const pool = cachedProducts.length ? cachedProducts : products.items
    return filterProducts(pool, ALL_CATEGORY, searchNeedle)
  }, [searching, searchNeedle, cachedProducts, products.items])

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
    if (!query.trim()) return
    setSearchOpen(true)
    setBrowseOpen(true)
  }, [query])

  function selectCategory(next: CategoryFilter) {
    setCategoryFilter(resolveCategoryFilter(categories, next))
  }

  useEffect(() => {
    const resolved = resolveCategoryFilter(categories, categoryFilter)
    if (resolved !== categoryFilter) setCategoryFilter(resolved)
  }, [categories, categoryFilter])

  const activeNav = useStoreScrollNav(
    () => [
      { id: 'home', el: homeRef.current },
      { id: 'categories', el: categoriesRef.current },
      { id: 'products', el: productsRef.current },
      { id: 'contact', el: document.getElementById('store-contact') },
    ],
    [store.id, browseOpen],
  )

  useEffect(() => {
    if (browseOpen) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [browseOpen])

  function exitBrowse(scrollHome = false) {
    setBrowseOpen(false)
    setSearchOpen(false)
    setSearchDraft('')
    setQuery('')
    if (scrollHome) categoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToProducts() {
    productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleToggleSearch() {
    if (searchOpen) {
      if (!searchDraft.trim() && !query.trim()) setBrowseOpen(false)
      setSearchOpen(false)
      setSearchDraft('')
      setQuery('')
      return
    }
    setCategoryFilter(ALL_CATEGORY)
    setBrowseOpen(true)
    setSearchOpen(true)
  }

  function handleNav(id: string) {
    if (browseOpen) {
      exitBrowse()
      return
    }
    if (id === 'home') window.scrollTo({ top: 0, behavior: 'smooth' })
    if (id === 'categories') categoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (id === 'products') scrollToProducts()
    if (id === 'contact') document.getElementById('store-contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  function openBrowse(next: CategoryFilter = ALL_CATEGORY) {
    selectCategory(next)
    setBrowseOpen(true)
  }

  const browseTitle = searching
    ? 'Search results'
    : searchOpen
      ? 'Search'
      : categoryLabel(categories, categoryFilter)

  const showHomeViewAll =
    !browseOpen &&
    (!products.lastPage || products.totalElements > products.items.length)

  return (
    <>
      <StorefrontHeader
        storeName={store.name}
        logoUrl={store.theme?.logoImage}
        cartCount={itemCount}
        cartHref={storeCartPath(store.id)}
        activeNav={browseOpen ? 'categories' : activeNav}
        searchOpen={searchOpen}
        onToggleSearch={handleToggleSearch}
        onNavClick={handleNav}
        onOpenMenu={() =>
          browseOpen ? exitBrowse(true) : categoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        pageTitle={browseOpen ? browseTitle : undefined}
        onBack={browseOpen ? () => exitBrowse(true) : undefined}
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
          products.error && products.items.length === 0 && !products.loading && !searching ? (
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
              totalElements={products.totalElements}
              hasMore={!products.lastPage}
              loading={products.loading && !searching}
              loadingMore={products.loadingMore}
              onLoadMore={products.loadMore}
            />
          )
        ) : (
          <>
            <div ref={homeRef} data-nav-section="home" className="flex flex-col gap-5 sm:gap-6">
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

            <div ref={categoriesRef} data-nav-section="categories">
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

            <section ref={productsRef} data-nav-section="products">
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
