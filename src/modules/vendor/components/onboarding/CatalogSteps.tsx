import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RefreshCwIcon,
  SearchIcon,
  StoreIcon,
} from 'lucide-react'
import categoryFallbackImage from '@/assets/onboarding/category-fallback.svg'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { cn } from '@/lib/utils'
import { Button, EmptyState } from '@/shared/components/ui'
import type { ProductReference } from '@/shared/api'
import {
  useBusinessTypeReferences,
  useCategoryReferences,
  useProductReferences,
} from '../../hooks/use-onboarding-catalog'
import { appendMissingReferenceItems } from '../../lib/onboarding-catalog-cache'
import { useOnboardingStore } from '../../store/onboarding-store'
import { ONBOARDING_CONFIG, type ValidationIssue } from '../../types/onboarding'
import {
  CatalogError,
  CatalogLoading,
  ChoiceCard,
  FieldError,
  FieldLabel,
  type RequestConfirmation,
} from './StepPrimitives'

type CatalogStepProps = {
  issues: ValidationIssue[]
  confirm: RequestConfirmation
  onUseSample: () => void
}

function ReferenceThumb({
  src,
  fallbackSrc,
}: {
  src: string | null
  fallbackSrc: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const usingFallback = !src || failedSrc === src

  return (
    <img
      src={usingFallback ? fallbackSrc : src}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-12 shrink-0 rounded-lg object-cover"
      onError={() => {
        if (!usingFallback && src) setFailedSrc(src)
      }}
    />
  )
}

function resolveBusinessIcon(src: string | null) {
  if (!src) return null

  try {
    const url = new URL(src)
    if (url.protocol !== 'https:') return null
    return {
      src: url.href,
      isSvg: url.pathname.toLowerCase().endsWith('.svg'),
    }
  } catch {
    return null
  }
}

function BusinessTypeIcon({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  const icon = useMemo(() => resolveBusinessIcon(src), [src])

  return (
    <span
      aria-hidden="true"
      className="grid size-10 place-items-center rounded-lg bg-primary/[0.07] text-primary"
    >
      {!icon || failed ? (
        <StoreIcon className="size-5" />
      ) : (
        <img
          src={icon.src}
          alt=""
          width={30}
          height={30}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cn(
            'size-7.5 object-contain',
            icon.isSvg && 'dark:brightness-0 dark:invert',
          )}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

export function BusinessStep({ issues, confirm, onUseSample }: CatalogStepProps) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const references = useBusinessTypeReferences(draft.referenceMode)
  const loadMoreBusinessTypes = references.loadMore
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [infiniteScrollArmed, setInfiniteScrollArmed] = useState(false)
  const selected = draft.business.businessType
  const items = appendMissingReferenceItems(
    references.items,
    selected && (
      !references.committedQuery ||
      selected.name.toLowerCase().includes(references.committedQuery)
    ) ? [selected] : [],
  )
  const initialError = Boolean(references.error && !references.items.length)
  const incrementalError = Boolean(references.error && references.items.length)
  const showInitialSkeleton = references.loading || (
    references.searchPending && !items.length
  )
  const canLoadMore = Boolean(
    references.items.length &&
    !references.loading &&
    !references.searchPending &&
    !references.loadingMore &&
    !references.error &&
    !references.lastPage,
  )

  useEffect(() => {
    setInfiniteScrollArmed(false)
  }, [draft.referenceMode, references.committedQuery])

  useEffect(() => {
    if (infiniteScrollArmed) return
    const formScroll = document.getElementById('onboarding-form-scroll')
    const armFromFormScroll = () => {
      if (formScroll && formScroll.scrollTop > 0) setInfiniteScrollArmed(true)
    }

    formScroll?.addEventListener('scroll', armFromFormScroll, { passive: true })
    return () => {
      formScroll?.removeEventListener('scroll', armFromFormScroll)
    }
  }, [infiniteScrollArmed])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const scrollRoot = document.getElementById('onboarding-form-scroll')
    if (
      !infiniteScrollArmed ||
      !canLoadMore ||
      !sentinel ||
      !scrollRoot ||
      typeof IntersectionObserver === 'undefined'
    ) return

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.75) {
        loadMoreBusinessTypes()
      }
    }, {
      root: scrollRoot,
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.75,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    canLoadMore,
    draft.referenceMode,
    infiniteScrollArmed,
    loadMoreBusinessTypes,
    references.committedQuery,
    references.pageNumber,
  ])

  const chooseBusinessType = (businessType: NonNullable<typeof selected>) => {
    if (selected?.id === businessType.id) return
    const apply = () => updateDraft(
      (current) => ({
        ...current,
        business: { ...current.business, businessType },
        categories: [],
        products: [],
        skus: [],
      }),
      3,
    )
    if (selected) {
      confirm({
        title: 'Change business type?',
        description: 'Changing the business type removes all selected categories, products, and draft SKUs because they belong to the previous catalog.',
        confirmLabel: 'Change and clear catalog',
        tone: 'danger',
        onConfirm: apply,
      })
    } else apply()
  }

  return (
    <div>
      <section aria-label="Business type">
        <form
          role="search"
          className="mb-4"
          onSubmit={(event) => {
            event.preventDefault()
            references.submitSearch()
          }}
        >
          <FieldLabel htmlFor="business-search">Business type</FieldLabel>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
            <input
              id="business-search"
              type="search"
              value={references.searchInput}
              onChange={(event) => references.setSearchInput(event.target.value)}
              placeholder={draft.referenceMode === 'live' ? 'Search live business types' : 'Search sample business types'}
              aria-controls="business-type"
              aria-busy={references.searchPending || references.loading}
              enterKeyHint="search"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
            />
          </div>
        </form>
        {initialError && draft.referenceMode === 'live' ? (
          <CatalogError message={references.error ?? 'The live business catalog could not be loaded.'} onRetry={references.retry} onUseSample={onUseSample} />
        ) : null}
        {!references.loading && !references.error && !references.searchPending && !items.length ? (
          <EmptyState title="No business types found" description="Try a broader search or switch explicitly to the sample catalog." />
        ) : null}
        {showInitialSkeleton || items.length ? (
          <div
            id="business-type"
            role="region"
            aria-label="Business type choices"
            aria-busy={references.loading || references.loadingMore}
          >
            {showInitialSkeleton ? <CatalogLoading count={6} cardClassName="h-16 rounded-xl" /> : null}
            {items.length ? (
              <div className={cn('grid gap-3 @min-[32rem]:grid-cols-2', showInitialSkeleton && 'mt-3')}>
                {items.map((item) => (
                  <ChoiceCard
                    key={item.id}
                    selected={selected?.id === item.id}
                    title={item.name}
                    leading={<BusinessTypeIcon key={item.icon ?? `fallback-${item.id}`} src={item.icon} />}
                    onClick={() => chooseBusinessType(item)}
                  />
                ))}
              </div>
            ) : null}
            {references.loadingMore && !references.searchPending ? (
              <div className="mt-3">
                <CatalogLoading count={2} cardClassName="h-16 rounded-xl" />
              </div>
            ) : null}
            {incrementalError ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50/90 p-3 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100" role="alert">
                <p className="min-w-0 flex-1 text-xs leading-5">More business types could not be loaded. {references.error}</p>
                <Button variant="outline" size="sm" onClick={references.retry}>
                  <RefreshCwIcon /> Retry
                </Button>
              </div>
            ) : null}
            <div ref={sentinelRef} className="h-2 w-full" aria-hidden="true" />
            {!references.lastPage && references.items.length ? (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={references.loading || references.loadingMore || references.searchPending || Boolean(references.error)}
                  onClick={() => {
                    if (
                      !references.loading &&
                      !references.loadingMore &&
                      !references.searchPending &&
                      !references.error &&
                      !references.lastPage
                    ) references.loadMore()
                  }}
                >
                  {references.loadingMore ? 'Loading...' : 'Show more'}
                </Button>
              </div>
            ) : null}
            {references.loadingMore || (references.lastPage && references.items.length) ? (
              <p
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {references.loadingMore
                  ? 'Loading more business types.'
                  : 'All business types are loaded.'}
              </p>
            ) : null}
          </div>
        ) : null}
        <FieldError issues={issues} field="business-type" />
      </section>
    </div>
  )
}

export function CategoryStep({ issues, confirm, onUseSample }: CatalogStepProps) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const [search, setSearch] = useState('')
  const businessTypeId = draft.business.businessType?.id ?? null
  const references = useCategoryReferences(draft.referenceMode, businessTypeId)
  const query = search.trim().toLowerCase()
  const availableItems = appendMissingReferenceItems(references.items, draft.categories)
  const loadedItems = query
    ? availableItems.filter((item) => item.name.toLowerCase().includes(query))
    : availableItems

  const toggle = (category: (typeof draft.categories)[number]) => {
    const selected = draft.categories.some((item) => item.id === category.id)
    if (!selected && draft.categories.length >= ONBOARDING_CONFIG.maxCategories) return
    const apply = () => updateDraft(
      (current) => {
        const categories = selected
          ? current.categories.filter((item) => item.id !== category.id)
          : [...current.categories, category]
        const allowedCategoryIds = new Set(categories.map((item) => item.id))
        const products = current.products.filter((item) => allowedCategoryIds.has(item.categoryId))
        const productIds = new Set(products.map((item) => item.id))
        return { ...current, categories, products, skus: current.skus.filter((sku) => productIds.has(sku.productId)) }
      },
      4,
    )
    const dependentCount = draft.products.filter((item) => item.categoryId === category.id).length
    if (selected && dependentCount) {
      confirm({
        title: `Remove ${category.name}?`,
        description: `This also removes ${dependentCount} selected product${dependentCount === 1 ? '' : 's'} and every related draft SKU.`,
        confirmLabel: 'Remove category',
        tone: 'danger',
        onConfirm: apply,
      })
    } else apply()
  }

  if (!businessTypeId) {
    return <EmptyState title="Choose a business type first" description="Return to Step 3 so the catalog can load matching categories." />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{draft.categories.length} of {ONBOARDING_CONFIG.maxCategories} selected</p>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
        <input
          id="category-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search loaded categories"
          className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
        />
      </div>
      {references.loading ? <CatalogLoading /> : null}
      {references.error && draft.referenceMode === 'live' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
      {!references.loading && !references.error && !loadedItems.length ? (
        <EmptyState title="No categories found" description={search ? 'Try another search.' : 'This business type has no available categories.'} />
      ) : null}
      {loadedItems.length ? (
        <div id="categories" className="grid gap-3 @min-[32rem]:grid-cols-2">
          {loadedItems.map((category) => {
            const selected = draft.categories.some((item) => item.id === category.id)
            const atLimit = !selected && draft.categories.length >= ONBOARDING_CONFIG.maxCategories
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                aria-disabled={atLimit}
                onClick={() => toggle(category)}
                className={cn(
                  'flex items-center gap-3 rounded-xl p-3 text-left outline-none transition-[background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-primary/25 active:scale-[0.99] motion-reduce:transform-none',
                  selected
                    ? 'bg-primary/[0.09] ring-1 ring-primary/25 ring-inset'
                    : 'bg-muted/35 hover:bg-muted/65',
                  atLimit && 'cursor-not-allowed opacity-45',
                )}
              >
                <ReferenceThumb src={category.imageUrl} fallbackSrc={categoryFallbackImage} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{category.name}</strong>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{category.description || 'Catalog category'}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
      <FieldError issues={issues} field="categories" />
      {!references.lastPage ? (
        <Button variant="outline" size="sm" disabled={references.loadingMore} onClick={references.loadMore}>
          {references.loadingMore ? 'Loading…' : 'Load more categories'}
        </Button>
      ) : null}
    </div>
  )
}

function ProductCategoryPicker({
  categoryId,
  categoryName,
  confirm,
  onUseSample,
}: {
  categoryId: number
  categoryName: string
  confirm: RequestConfirmation
  onUseSample: () => void
}) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const references = useProductReferences(draft.referenceMode, categoryId)
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const selectedForCategory = draft.products.filter((item) => item.categoryId === categoryId)
  const availableItems = appendMissingReferenceItems<ProductReference>(
    references.items,
    selectedForCategory,
  )
  const items = query
    ? availableItems.filter((item) => item.name.toLowerCase().includes(query))
    : availableItems

  const toggle = (product: ProductReference) => {
    const selected = draft.products.some((item) => item.id === product.id)
    const apply = () => updateDraft(
      (current) => ({
        ...current,
        products: selected
          ? current.products.filter((item) => item.id !== product.id)
          : [...current.products, { ...product, categoryId }],
        skus: selected
          ? current.skus.filter((sku) => sku.productId !== product.id)
          : current.skus,
      }),
      5,
    )
    const dependentSkus = draft.skus.filter((sku) => sku.productId === product.id).length
    if (selected && dependentSkus) {
      confirm({
        title: `Remove ${product.name}?`,
        description: `This also removes ${dependentSkus} draft SKU${dependentSkus === 1 ? '' : 's'} and its pricing.`,
        confirmLabel: 'Remove product',
        tone: 'danger',
        onConfirm: apply,
      })
    } else apply()
  }

  return (
    <section className="rounded-xl bg-muted/25 p-4" aria-labelledby={`category-products-${categoryId}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id={`category-products-${categoryId}`} className="font-display font-semibold">{categoryName}</h3>
          <p className="text-xs text-muted-foreground">{selectedForCategory.length} selected</p>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <input
            type="search"
            aria-label={`Search products in ${categoryName}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search loaded products"
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
          />
        </div>
      </div>
      {references.loading ? <CatalogLoading count={4} /> : null}
      {references.error && draft.referenceMode === 'live' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
      {!references.loading && !references.error && !items.length ? (
        <EmptyState title="No products found" description={search ? 'Try another search.' : 'No products are currently listed for this category.'} />
      ) : null}
      {items.length ? (
        <div className="grid gap-2 @min-[32rem]:grid-cols-2">
          {items.map((product) => {
            const selected = draft.products.some((item) => item.id === product.id)
            return (
              <button
                key={product.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(product)}
                className={cn(
                  'flex items-center gap-3 rounded-xl p-2.5 text-left outline-none transition-[background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-primary/25 active:scale-[0.99] motion-reduce:transform-none',
                  selected
                    ? 'bg-primary/[0.09] ring-1 ring-primary/25 ring-inset'
                    : 'bg-background/75 hover:bg-background',
                )}
              >
                <ReferenceThumb src={product.imageUrl} fallbackSrc={productFallbackImage} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{product.name}</strong>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{product.measurementName || 'Item'}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
      {!references.lastPage ? (
        <Button className="mt-3" variant="outline" size="sm" disabled={references.loadingMore} onClick={references.loadMore}>
          {references.loadingMore ? 'Loading…' : `Load more in ${categoryName}`}
        </Button>
      ) : null}
    </section>
  )
}

export function ProductStep({ issues, confirm, onUseSample }: CatalogStepProps) {
  const categories = useOnboardingStore((state) => state.draft.categories)
  const selectedProducts = useOnboardingStore((state) => state.draft.products)
  const summary = useMemo(
    () => categories.map((category) => ({ ...category, count: selectedProducts.filter((item) => item.categoryId === category.id).length })),
    [categories, selectedProducts],
  )

  if (!categories.length) {
    return <EmptyState title="Choose categories first" description="Return to Step 4 to select at least one category." />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {summary.map((category) => (
          <span key={category.id} className="rounded-full bg-muted px-2.5 py-1 font-medium">
            {category.name}: {category.count}
          </span>
        ))}
      </div>
      <div id="products" className="space-y-4">
        {categories.map((category) => (
          <ProductCategoryPicker
            key={category.id}
            categoryId={category.id}
            categoryName={category.name}
            confirm={confirm}
            onUseSample={onUseSample}
          />
        ))}
      </div>
      <FieldError issues={issues} field="products" />
    </div>
  )
}
