import { useEffect, useMemo, useRef, useState, type ToggleEvent } from 'react'
import {
  RefreshCwIcon,
  SearchIcon,
  StoreIcon,
} from 'lucide-react'
import categoryFallbackImage from '@/assets/onboarding/category-fallback.svg'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { cn } from '@/lib/utils'
import { Button, EmptyState } from '@/shared/components/ui'
import { isLiveApi, type ProductReference } from '@/shared/api'
import {
  useBusinessTypeReferences,
  useCategoryReferences,
  useProductReferences,
} from '../../hooks/use-onboarding-catalog'
import { useSingleOpen } from '../../hooks/use-single-open'
import { appendMissingReferenceItems } from '../../lib/onboarding-catalog-cache'
import { writesReachAccount } from '../../lib/onboarding-sync'
import { StepNotice } from './AccessNotice'
import {
  selectCatalogPolicy,
  selectCategoryLimit,
  selectStoreIsSubmitted,
  useOnboardingStore,
} from '../../store/onboarding-store'
import type { ValidationIssue } from '../../types/onboarding'
import { AuthorCategoryForm, AuthorProductForm, PermanenceNotice } from './CatalogAuthoring'
import { AccordionPanel, CatalogError, CatalogLoading, ChoiceCard, FieldError, FieldLabel, type RequestConfirmation } from './StepPrimitives'

type CatalogStepProps = {
  issues: ValidationIssue[]
  confirm: RequestConfirmation
  onUseSample?: () => void
}

function catalogChoiceState(
  entries: ReadonlyArray<{ id: number; pending?: true }>,
  entryId: number,
) {
  const matchingEntry = entries.find((entry) => entry.id === entryId)
  return {
    chosen: matchingEntry !== undefined,
    pending: matchingEntry?.pending === true,
  }
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
      className="grid size-10 place-items-center rounded-lg bg-[var(--ob-brand-soft)] text-primary"
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
  const references = useBusinessTypeReferences(draft.catalogSource)
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
  }, [draft.catalogSource, references.committedQuery])

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
    draft.catalogSource,
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
        description: 'Changing the business type removes all selected categories, products, and their sizes and prices, because they belong to the previous catalog.',
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
            <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-[var(--ob-ink-soft)]" />
            <input
              id="business-search"
              type="search"
              value={references.searchInput}
              onChange={(event) => references.setSearchInput(event.target.value)}
              placeholder={draft.catalogSource === 'account' ? 'Search live business types' : 'Search sample business types'}
              aria-controls="business-type"
              aria-busy={references.searchPending || references.loading}
              enterKeyHint="search"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] pr-3 pl-9 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
            />
          </div>
        </form>
        {initialError && draft.catalogSource === 'account' ? (
          <CatalogError message={references.error ?? 'The live business catalog could not be loaded.'} onRetry={references.retry} onUseSample={onUseSample} />
        ) : null}
        {!references.loading && !references.error && !references.searchPending && !items.length ? (
          <EmptyState
            title="No business types found"
            description={onUseSample
              ? 'Try a broader search or switch explicitly to the sample catalog.'
              : 'Try a broader search.'}
          />
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
  const removePendingEntry = useOnboardingStore((state) => state.removePendingEntry)
  const [search, setSearch] = useState('')
  const [blocked, setBlocked] = useState<string | null>(null)
  const categoryLimit = useOnboardingStore(selectCategoryLimit)
  const isCategoryAssigned = useOnboardingStore((state) => state.isCategoryAssigned)
  const storeIsSubmitted = useOnboardingStore(selectStoreIsSubmitted)
  const liveApi = isLiveApi()
  const createControlVisible = useOnboardingStore(
    (state) => selectCatalogPolicy(state, { liveApi }).createControlVisible,
  )
  const businessTypeId = draft.business.businessType?.id ?? null
  const references = useCategoryReferences(draft.catalogSource, businessTypeId)
  const query = search.trim().toLowerCase()
  const availableItems = appendMissingReferenceItems(references.items, draft.categories)
  const loadedItems = query
    ? availableItems.filter((item) => item.name.toLowerCase().includes(query))
    : availableItems

  const toggle = (category: (typeof draft.categories)[number]) => {
    const choice = catalogChoiceState(draft.categories, category.id)
    if (!choice.chosen && draft.categories.length >= categoryLimit) return
    if (choice.chosen && isCategoryAssigned(category.id)) {
      setBlocked(
        `${category.name} is already saved to your store. Categories cannot be removed here yet — contact support if you need it taken off.`,
      )
      return
    }
    setBlocked(null)
    const applyCategoryChoice = () => {
      if (choice.pending) {
        removePendingEntry(category.id)
        return
      }
      updateDraft(
        (current) => {
          const categories = choice.chosen
            ? current.categories.filter((item) => item.id !== category.id)
            : [...current.categories, category]
          const allowedCategoryIds = new Set(categories.map((item) => item.id))
          const products = current.products.filter((item) => allowedCategoryIds.has(item.categoryId))
          const productIds = new Set(products.map((item) => item.id))
          return { ...current, categories, products, skus: current.skus.filter((sku) => productIds.has(sku.productId)) }
        },
        4,
      )
    }
    const dependentCount = draft.products.filter((item) => item.categoryId === category.id).length
    if (choice.chosen && dependentCount) {
      confirm({
        title: `Remove ${category.name}?`,
        description: `This also removes ${dependentCount} selected product${dependentCount === 1 ? '' : 's'} and every size priced under ${dependentCount === 1 ? 'it' : 'them'}.`,
        confirmLabel: 'Remove category',
        tone: 'danger',
        onConfirm: applyCategoryChoice,
      })
    } else applyCategoryChoice()
  }

  if (!businessTypeId) {
    return <EmptyState title="Choose a business type first" description="Return to Step 3 so the catalog can load matching categories." />
  }

  return (
    <div className="space-y-4">
      {writesReachAccount(draft.catalogSource) ? <PermanenceNotice kind="categories" /> : null}
      {blocked ? <StepNotice message={blocked} /> : null}
      <p className="text-sm text-[var(--ob-ink-soft)]">{draft.categories.length} of {categoryLimit} selected</p>
      {createControlVisible && !storeIsSubmitted ? (
        <AuthorCategoryForm onAdded={() => setSearch('')} />
      ) : null}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-[var(--ob-ink-soft)]" />
        <input
          id="category-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search loaded categories"
          className="h-11 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] pr-3 pl-9 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
        />
      </div>
      {references.loading ? <CatalogLoading /> : null}
      {references.error && draft.catalogSource === 'account' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
      {!references.loading && !references.error && !loadedItems.length ? (
        <EmptyState title="No categories found" description={search ? 'Try another search.' : 'This business type has no available categories.'} />
      ) : null}
      {loadedItems.length ? (
        <div id="categories" className="grid gap-3 @min-[32rem]:grid-cols-2">
          {loadedItems.map((category) => {
            const choice = catalogChoiceState(draft.categories, category.id)
            const atLimit = !choice.chosen && draft.categories.length >= categoryLimit
            const onStore = choice.chosen && isCategoryAssigned(category.id)
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={choice.chosen}
                aria-disabled={atLimit || onStore}
                onClick={() => toggle(category)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left outline-none transition-[border-color,background-color] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]',
                  choice.chosen
                    ? 'border-[var(--ob-brand)] bg-[var(--ob-brand-soft)]'
                    : 'border-[var(--ob-line)] bg-[var(--ob-sheet)] hover:border-[var(--ob-brand)]/45 hover:bg-[var(--ob-brand-soft)]/40',
                  atLimit && 'cursor-not-allowed opacity-45 hover:border-[var(--ob-line)] hover:bg-[var(--ob-sheet)]',
                )}
              >
                <ReferenceThumb src={category.imageUrl} fallbackSrc={categoryFallbackImage} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-[var(--ob-ink)]">{category.name}</strong>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ob-ink-soft)]">
                    {onStore
                      ? 'Saved to your store'
                      : choice.pending
                        ? 'Not saved yet — select to remove'
                        : category.description || 'Catalog category'}
                  </span>
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
  open,
  onToggle,
  createControlVisible,
}: {
  categoryId: number
  categoryName: string
  confirm: RequestConfirmation
  onUseSample?: () => void
  open: boolean
  onToggle: (event: ToggleEvent<HTMLDetailsElement>) => void
  createControlVisible: boolean
}) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const removePendingEntry = useOnboardingStore((state) => state.removePendingEntry)
  const references = useProductReferences(draft.catalogSource, categoryId)
  const [search, setSearch] = useState('')
  const [blocked, setBlocked] = useState<string | null>(null)
  const isProductAssigned = useOnboardingStore((state) => state.isProductAssigned)
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
    const choice = catalogChoiceState(draft.products, product.id)
    if (choice.chosen && isProductAssigned(product.id)) {
      setBlocked(
        `${product.name} is already saved to your store. Products cannot be removed here yet — contact support if you need it taken off. You can set it inactive on the next step instead.`,
      )
      return
    }
    setBlocked(null)
    const applyProductChoice = () => {
      if (choice.pending) {
        removePendingEntry(product.id)
        return
      }
      updateDraft(
        (current) => ({
          ...current,
          products: choice.chosen
            ? current.products.filter((item) => item.id !== product.id)
            : [...current.products, { ...product, categoryId }],
          skus: choice.chosen
            ? current.skus.filter((sku) => sku.productId !== product.id)
            : current.skus,
        }),
        5,
      )
    }
    const dependentSkus = draft.skus.filter((sku) => sku.productId === product.id).length
    if (choice.chosen && dependentSkus) {
      confirm({
        title: `Remove ${product.name}?`,
        description: `This also removes ${dependentSkus} size${dependentSkus === 1 ? '' : 's'} and ${dependentSkus === 1 ? 'its' : 'their'} pricing.`,
        confirmLabel: 'Remove product',
        tone: 'danger',
        onConfirm: applyProductChoice,
      })
    } else applyProductChoice()
  }

  return (
    <AccordionPanel
      id={`category-products-${categoryId}`}
      open={open}
      onToggle={onToggle}
      summary={
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.01em] text-[var(--ob-ink)]">{categoryName}</h3>
          <p className="mt-0.5 text-xs text-[var(--ob-ink-soft)]">
            {selectedForCategory.length ? `${selectedForCategory.length} chosen` : 'Nothing chosen yet'}
          </p>
        </div>
      }
    >
      {createControlVisible ? (
        <AuthorProductForm
          categoryId={categoryId}
          categoryName={categoryName}
          onAdded={() => setSearch('')}
        />
      ) : null}
      {/* Search lives in the panel, not the summary: a click inside the summary row
          would collapse the group the vendor is trying to search. */}
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-[var(--ob-ink-soft)]" />
        <input
          type="search"
          aria-label={`Search products in ${categoryName}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search loaded products"
          className="h-9 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] pr-3 pl-9 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
        />
      </div>
      {blocked ? <div className="mb-3"><StepNotice message={blocked} /></div> : null}
      {references.loading ? <CatalogLoading count={4} /> : null}
      {references.error && draft.catalogSource === 'account' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
      {!references.loading && !references.error && !items.length ? (
        <EmptyState title="No products found" description={search ? 'Try another search.' : 'No products are currently listed for this category.'} />
      ) : null}
      {items.length ? (
        <div className="grid gap-2 @min-[32rem]:grid-cols-2">
          {items.map((product) => {
            const choice = catalogChoiceState(draft.products, product.id)
            const onStore = choice.chosen && isProductAssigned(product.id)
            return (
              <button
                key={product.id}
                type="button"
                aria-pressed={choice.chosen}
                aria-disabled={onStore}
                onClick={() => toggle(product)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-2.5 text-left outline-none transition-[border-color,background-color] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]',
                  choice.chosen
                    ? 'border-[var(--ob-brand)] bg-[var(--ob-brand-soft)]'
                    : 'border-[var(--ob-line)] bg-[var(--ob-sheet)] hover:border-[var(--ob-brand)]/45 hover:bg-[var(--ob-brand-soft)]/40',
                )}
              >
                <ReferenceThumb src={product.imageUrl} fallbackSrc={productFallbackImage} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-[var(--ob-ink)]">{product.name}</strong>
                  <span className="mt-1 block truncate text-xs text-[var(--ob-ink-soft)]">
                    {onStore
                      ? 'Saved to your store'
                      : choice.pending
                        ? 'Not saved yet — select to remove'
                        : product.measurementName || 'Item'}
                  </span>
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
    </AccordionPanel>
  )
}

export function ProductStep({ issues, confirm, onUseSample }: CatalogStepProps) {
  const categories = useOnboardingStore((state) => state.draft.categories)
  const catalogSource = useOnboardingStore((state) => state.draft.catalogSource)
  const selectedProducts = useOnboardingStore((state) => state.draft.products)
  const storeIsSubmitted = useOnboardingStore(selectStoreIsSubmitted)
  const liveApi = isLiveApi()
  const createControlVisible = useOnboardingStore(
    (state) => selectCatalogPolicy(state, { liveApi }).createControlVisible,
  )
  const summary = useMemo(
    () => categories.map((category) => ({ ...category, count: selectedProducts.filter((item) => item.categoryId === category.id).length })),
    [categories, selectedProducts],
  )
  const categoryIds = useMemo(() => categories.map((category) => category.id), [categories])
  const { openId, onToggle } = useSingleOpen(categoryIds)

  if (!categories.length) {
    return <EmptyState title="Choose categories first" description="Return to Step 4 to select at least one category." />
  }

  return (
    <div className="space-y-4">
      {writesReachAccount(catalogSource) ? <PermanenceNotice kind="products" /> : null}
      <div className="flex flex-wrap gap-2 text-xs">
        {summary.map((category) => (
          <span key={category.id} className="rounded-full bg-muted px-2.5 py-1 font-medium">
            {category.name}: {category.count}
          </span>
        ))}
      </div>
      <div id="products" className="space-y-3">
        {categories.map((category) => (
          <ProductCategoryPicker
            key={category.id}
            categoryId={category.id}
            categoryName={category.name}
            confirm={confirm}
            onUseSample={onUseSample}
            open={openId === category.id}
            onToggle={onToggle(category.id)}
            createControlVisible={createControlVisible && !storeIsSubmitted}
          />
        ))}
      </div>
      <FieldError issues={issues} field="products" />
    </div>
  )
}
