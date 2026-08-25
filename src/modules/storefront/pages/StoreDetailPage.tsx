import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CategoryBrowseSection,
  CategoryScroller,
  OfferBanner,
  ProductGrid,
  ServiceInfoBar,
  StorePageFooter,
  StorePageStates,
  StorefrontHeader,
} from '@/modules/storefront/components'
import { useStoreScrollNav } from '@/modules/storefront/hooks/useStoreScrollNav'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import {
  ALL_CATEGORY,
  buildCategories,
  categoryLabel,
  filterProducts,
  previewProducts,
  PRODUCT_PREVIEW_LIMIT,
} from '@/modules/storefront/lib/catalog-filters'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Store } from '@/modules/storefront/types'
import { SearchField } from '@/shared/components'
import { useSearchQueryParam } from '@/shared/hooks/useSearchQueryParam'

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
  const hasQuery = Boolean(query.trim())
  const [searchOpen, setSearchOpen] = useState(hasQuery)
  const [categoryId, setCategoryId] = useState(ALL_CATEGORY)
  const [browseOpen, setBrowseOpen] = useState(hasQuery)
  const homeRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLElement>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)

  const categories = useMemo(() => buildCategories(store), [store])
  const homeProducts = useMemo(
    () => filterProducts(store.products, categoryId, ''),
    [store.products, categoryId],
  )
  const displayedProducts = useMemo(() => previewProducts(homeProducts), [homeProducts])
  const hasMoreProducts = homeProducts.length > PRODUCT_PREVIEW_LIMIT

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
    if (!hasQuery) return
    setSearchOpen(true)
    setBrowseOpen(true)
    setCategoryId(ALL_CATEGORY)
  }, [hasQuery])

  useEffect(() => {
    if (browseOpen) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [browseOpen])

  function exitBrowse(scrollHome = false) {
    setBrowseOpen(false)
    setSearchOpen(false)
    setQuery('')
    if (scrollHome) categoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToProducts() {
    productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleToggleSearch() {
    if (searchOpen) {
      if (!hasQuery) setBrowseOpen(false)
      setSearchOpen(false)
      setQuery('')
      return
    }
    setCategoryId(ALL_CATEGORY)
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

  function openBrowse(nextCategoryId: string = ALL_CATEGORY) {
    setCategoryId(nextCategoryId)
    setBrowseOpen(true)
  }

  const browseTitle = hasQuery
    ? 'Search results'
    : searchOpen
      ? 'Search'
      : categoryLabel(categories, categoryId)

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
              value={query}
              onChange={setQuery}
              placeholder="Search pickles, combos, gifts…"
              aria-label="Search products"
              autoFocus
            />
          </div>
        </div>
      ) : null}

      <main className="store-shell-inner flex flex-1 flex-col gap-4 py-4 sm:gap-5 sm:py-5">
        {browseOpen ? (
          <CategoryBrowseSection
            storeId={store.id}
            storeName={store.name}
            categories={categories}
            products={store.products}
            categoryId={categoryId}
            query={query}
            onCategoryChange={setCategoryId}
          />
        ) : (
          <>
            <div ref={homeRef} data-nav-section="home">
              <OfferBanner
                badge={store.offer}
                title={store.name}
                subtitle={store.tagline ?? store.category}
                heroImage={store.heroImage}
                onShopNow={scrollToProducts}
              />
              <ServiceInfoBar storeId={store.id} className="mt-4 sm:mt-5" />
            </div>

            <div ref={categoriesRef} data-nav-section="categories">
              <CategoryScroller
                categories={categories}
                activeId={categoryId}
                showAllOption
                onSelect={(id) => {
                  setCategoryId(id)
                  scrollToProducts()
                }}
                onViewAll={() => openBrowse(ALL_CATEGORY)}
                actionLabel="View all"
              />
            </div>

            <section ref={productsRef} data-nav-section="products">
              <ProductGrid
                storeId={store.id}
                storeName={store.name}
                title={categoryLabel(categories, categoryId)}
                products={displayedProducts}
                actionLabel="View all"
                onAction={hasMoreProducts ? () => openBrowse(categoryId) : undefined}
                emptyTitle="No products match"
                emptyDescription="No items in this category yet."
              />
            </section>
          </>
        )}
      </main>

      <StorePageFooter store={store} />
    </>
  )
}
