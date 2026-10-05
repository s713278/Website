import { useEffect, useMemo, useRef, useState, type ToggleEvent } from 'react'
import {
  CheckIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
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
import { measurementLabel, productMeasurementSummary } from '../../lib/onboarding-measurement'
import { writesReachAccount } from '../../lib/onboarding-sync'
import { StepNotice } from './AccessNotice'
import {
  selectCatalogPolicy,
  selectCategoryLimitReached,
  selectProductLimit,
  selectProductLimitReached,
  useOnboardingStore,
} from '../../store/onboarding-store'
import { ONBOARDING_CONFIG, type ValidationIssue } from '../../types/onboarding'
import { AuthorCategoryForm, AuthorProductForm, PermanenceNotice } from './CatalogAuthoring'
import { CatalogError, CatalogLoading, CategoryPanel, ChoiceCard, choiceGrid, FieldError, FieldLabel, type RequestConfirmation } from './StepPrimitives'

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
  iconSrc,
  imageSrc,
  fallbackSrc,
  className,
}: {
  iconSrc: string | null | undefined
  imageSrc: string | null
  fallbackSrc: string
  className?: string
}) {
  const [failedSources, setFailedSources] = useState<string[]>([])
  const sources = [iconSrc, imageSrc].filter((source): source is string => Boolean(source))
  const src = sources.find((source) => !failedSources.includes(source)) ?? fallbackSrc

  useEffect(() => {
    const currentSources = [iconSrc, imageSrc].filter((source): source is string => Boolean(source))
    setFailedSources((current) => current.filter((failed) => currentSources.includes(failed)))
  }, [iconSrc, imageSrc])

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('size-12 shrink-0 rounded-lg object-cover', className)}
      onError={() => {
        if (src !== fallbackSrc) {
          setFailedSources((current) => current.includes(src) ? current : [...current, src])
        }
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
      className="grid size-12 place-items-center rounded-xl bg-[var(--ob-brand-soft)] text-primary @min-[30rem]:size-10"
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

export function BusinessStep({ issues, onUseSample }: Omit<CatalogStepProps, 'confirm'>) {
  const draft = useOnboardingStore((state) => state.draft)
  const changeBusinessType = useOnboardingStore((state) => state.changeBusinessType)
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
    if (selected?.id !== businessType.id) changeBusinessType(businessType)
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
          <FieldLabel htmlFor="business-search">Search business type</FieldLabel>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-[var(--ob-ink-soft)]" />
            <input
              id="business-search"
              type="search"
              value={references.searchInput}
              onChange={(event) => references.setSearchInput(event.target.value)}
              placeholder="e.g. Bakery, Pickles, Dairy"
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
            {showInitialSkeleton ? <CatalogLoading count={ONBOARDING_CONFIG.businessTypePageSize} cardClassName="h-32 @min-[30rem]:h-26" className={choiceGrid} /> : null}
            {items.length ? (
              <div className={cn(choiceGrid, showInitialSkeleton && 'mt-3')}>
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
                <CatalogLoading count={3} cardClassName="h-32 @min-[30rem]:h-26" className={choiceGrid} />
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
  // The limit gates the projected account total — draft plus what the account already
  // holds — so a business-type change cannot reopen a fresh allowance on a full account.
  const categoryLimitReached = useOnboardingStore(selectCategoryLimitReached)
  const isCategoryAssigned = useOnboardingStore((state) => state.isCategoryAssigned)
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
    if (!choice.chosen && categoryLimitReached) return
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
      <div>
        <FieldLabel htmlFor="category-search">Search category</FieldLabel>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-[var(--ob-ink-soft)]" />
          <input
            id="category-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="e.g. Pickles, Meals, Cakes"
            aria-controls="categories"
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] pr-3 pl-9 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
          />
        </div>
      </div>
      {references.loading ? <CatalogLoading count={ONBOARDING_CONFIG.categoryPageSize} cardClassName="h-32 @min-[30rem]:h-26" className={choiceGrid} /> : null}
      {references.error && draft.catalogSource === 'account' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
      {!references.loading && !references.error && !loadedItems.length ? (
        <EmptyState title="No categories found" description={search ? 'Try another search.' : 'This business type has no available categories.'} />
      ) : null}
      {loadedItems.length ? (
        <div id="categories" className={choiceGrid}>
          {loadedItems.map((category) => {
            const choice = catalogChoiceState(draft.categories, category.id)
            const atLimit = !choice.chosen && categoryLimitReached
            const onStore = choice.chosen && isCategoryAssigned(category.id)
            return (
              <ChoiceCard
                key={category.id}
                selected={choice.chosen}
                inactive={atLimit}
                title={category.name}
                description={onStore
                  ? 'Saved to your store'
                  : choice.pending
                    ? 'Not saved yet — select to remove'
                    : null}
                leading={(
                  <ReferenceThumb
                    iconSrc={category.icon}
                    imageSrc={category.imageUrl}
                    fallbackSrc={categoryFallbackImage}
                    className="@min-[30rem]:size-10"
                  />
                )}
                onClick={() => toggle(category)}
              />
            )
          })}
        </div>
      ) : null}
      <FieldError issues={issues} field="categories" />
      {!references.lastPage ? (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" disabled={references.loadingMore} onClick={references.loadMore}>
            {references.loadingMore ? 'Loading…' : 'Show more categories'}
          </Button>
        </div>
      ) : null}
      {createControlVisible ? (
        <AuthorCategoryForm onAdded={() => setSearch('')} />
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
  const productMeasurementCatalog = useOnboardingStore((state) => state.productMeasurementCatalog)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const removePendingEntry = useOnboardingStore((state) => state.removePendingEntry)
  const references = useProductReferences(draft.catalogSource, categoryId)
  const [search, setSearch] = useState('')
  const [blocked, setBlocked] = useState<string | null>(null)
  const isProductAssigned = useOnboardingStore((state) => state.isProductAssigned)
  const productLimit = useOnboardingStore(selectProductLimit)
  const productLimitReached = useOnboardingStore(selectProductLimitReached)
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
    if (!choice.chosen && productLimitReached) {
      setBlocked(
        `You've reached your plan's limit of ${productLimit} products, counting those already saved to your store.`,
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

  const selectedCount = selectedForCategory.length
  const searchId = `product-search-${categoryId}`

  return (
    <CategoryPanel
      id={`category-products-${categoryId}`}
      open={open}
      onToggle={onToggle}
      name={categoryName}
      meta={selectedCount ? `${selectedCount} selected` : 'Nothing selected yet'}
      count={selectedCount}
    >
      {/* Search lives in the panel, not the summary: a click inside the summary row
          would collapse the group the vendor is trying to search. */}
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor={searchId}>Search in {categoryName}</FieldLabel>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-[var(--ob-ink-soft)]" />
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Try a name, e.g. tomato"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] pr-3 pl-9 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
            />
          </div>
        </div>
        {createControlVisible ? (
          <div className="border-t border-[var(--ob-line-soft)] pt-3">
            <AuthorProductForm
              categoryId={categoryId}
              categoryName={categoryName}
              onAdded={() => setSearch('')}
            />
          </div>
        ) : null}
        {blocked ? <StepNotice message={blocked} /> : null}
        {references.loading ? <CatalogLoading count={6} cardClassName="h-36 @min-[30rem]:h-32" className={choiceGrid} /> : null}
        {references.error && draft.catalogSource === 'account' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
        {!references.loading && !references.error && !items.length ? (
          <EmptyState title="No products found" description={search ? 'Try another search.' : 'No products are currently listed for this category.'} />
        ) : null}
        {items.length ? (
          <div className={choiceGrid}>
            {items.map((product) => {
              const choice = catalogChoiceState(draft.products, product.id)
              const onStore = choice.chosen && isProductAssigned(product.id)
              const atLimit = !choice.chosen && productLimitReached
              const measurementSummary = productMeasurementSummary(product, productMeasurementCatalog)
              const units = measurementSummary.additionalUnitCount
                ? [...measurementSummary.units, `+${measurementSummary.additionalUnitCount}`]
                : measurementSummary.units
              if (choice.pending) {
                return <PendingProductCard key={product.id} productId={product.id} onRemove={() => toggle(product)} />
              }
              return (
                <ChoiceCard
                  key={product.id}
                  selected={choice.chosen}
                  inactive={atLimit}
                  title={product.name}
                  description={onStore ? 'Saved to your store' : null}
                  leading={(
                    <ReferenceThumb
                      iconSrc={product.icon}
                      imageSrc={product.imageUrl}
                      fallbackSrc={productFallbackImage}
                      className="@min-[30rem]:size-10"
                    />
                  )}
                  footer={<MeasurementChips measurement={measurementSummary.measurement} units={units} />}
                  onClick={() => toggle(product)}
                />
              )
            })}
          </div>
        ) : null}
        {!references.lastPage ? (
          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-[var(--ob-brand)]/40 px-5 text-[var(--md-green-800)] hover:border-[var(--ob-brand)] hover:bg-[var(--ob-brand-soft)] dark:text-emerald-200"
              disabled={references.loadingMore}
              onClick={references.loadMore}
            >
              {references.loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        ) : null}
      </div>
    </CategoryPanel>
  )
}

/**
 * A product the vendor authored here, after the reference's dashed custom card. Until
 * Continue creates it, its measurement can still change, so the card carries the picker.
 * The whole card stays the remove target: a full-size button sits under the picker,
 * since a select cannot live inside a button.
 */
function PendingProductCard({ productId, onRemove }: { productId: number; onRemove: () => void }) {
  const product = useOnboardingStore((state) => state.draft.products.find((item) => item.id === productId))
  const measurementCatalog = useOnboardingStore((state) => state.measurementCatalog)
  const setPendingProductMeasurement = useOnboardingStore((state) => state.setPendingProductMeasurement)
  if (!product) return null
  const entry = measurementCatalog.find((item) => item.id === product.measurementId)
  const selectId = `pending-product-measurement-${productId}`

  return (
    <div className="relative flex min-h-32 w-full flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-[var(--ob-brand)] bg-[var(--ob-brand-soft)] px-3 py-4 text-center ring-3 ring-[var(--ob-brand-soft)] @min-[30rem]:min-h-26 @min-[30rem]:gap-2 @min-[30rem]:py-3.5">
      <button
        type="button"
        aria-pressed="true"
        aria-label={`${product.name}, added by you and not saved yet. Select to remove.`}
        onClick={onRemove}
        className="absolute inset-0 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-[var(--ob-brand)]/40"
      />
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-lg text-amber-500 @min-[30rem]:size-10">
        <SparklesIcon className="size-7" />
      </span>
      <span aria-hidden="true" className="line-clamp-2 text-sm leading-5 font-semibold text-[var(--md-green-800)] dark:text-[var(--ob-ink)]">
        {product.name}
      </span>
      <span className="relative z-10 flex flex-wrap items-center justify-center gap-1.5">
        <label htmlFor={selectId} className="text-xs font-medium text-[var(--ob-ink-soft)]">Sold by</label>
        <select
          id={selectId}
          value={entry?.id ?? ''}
          className="h-8 rounded-md border border-[var(--ob-line)] bg-[var(--ob-sheet)] px-2 text-xs font-medium text-[var(--ob-ink)] outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
          onChange={(event) => {
            const next = measurementCatalog.find((item) => item.id === Number(event.target.value))
            if (next) setPendingProductMeasurement(productId, { measurementId: next.id, measurementName: next.type })
          }}
        >
          {entry ? null : <option value="" disabled>Choose</option>}
          {measurementCatalog.map((item) => (
            <option key={item.id} value={item.id}>{measurementLabel(item.type)}</option>
          ))}
        </select>
        {entry?.units.map((unit) => (
          <span
            key={unit}
            className="rounded-full bg-[var(--ob-sheet)]/70 px-2 py-0.5 text-[0.6875rem] leading-4 font-medium text-[var(--md-green-800)] dark:text-emerald-200"
          >
            {unit}
          </span>
        ))}
      </span>
      <span className="pointer-events-none absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-[var(--ob-brand)] text-white" aria-hidden="true">
        <CheckIcon className="size-3 stroke-[3]" />
      </span>
    </div>
  )
}

/** How a product is sold: its measurement, then the units its sizes can use. */
function MeasurementChips({ measurement, units }: { measurement: string | null; units: string[] }) {
  if (!measurement) {
    return <span className="text-xs text-[var(--ob-ink-soft)]">Measurement unavailable</span>
  }
  return (
    <span className="flex flex-wrap justify-center gap-1">
      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold text-[var(--ob-ink)]">
        {measurement}
      </span>
      {units.map((unit) => (
        <span
          key={unit}
          className="rounded-full bg-[var(--ob-brand-soft)] px-2 py-0.5 text-[0.6875rem] leading-4 font-medium text-[var(--md-green-800)] dark:text-emerald-200"
        >
          {unit}
        </span>
      ))}
    </span>
  )
}

export function ProductStep({ issues, confirm, onUseSample }: CatalogStepProps) {
  const categories = useOnboardingStore((state) => state.draft.categories)
  const catalogSource = useOnboardingStore((state) => state.draft.catalogSource)
  const productLimit = useOnboardingStore(selectProductLimit)
  const productLimitReached = useOnboardingStore(selectProductLimitReached)
  const liveApi = isLiveApi()
  const createControlVisible = useOnboardingStore(
    (state) => selectCatalogPolicy(state, { liveApi }).createControlVisible,
  )
  const categoryIds = useMemo(() => categories.map((category) => category.id), [categories])
  const { openId, onToggle } = useSingleOpen(categoryIds)

  if (!categories.length) {
    return <EmptyState title="Choose categories first" description="Return to Step 4 to select at least one category." />
  }

  return (
    <div className="space-y-4">
      {writesReachAccount(catalogSource) ? <PermanenceNotice kind="products" /> : null}
      {productLimitReached ? (
        <StepNotice message={`You've reached your plan's limit of ${productLimit} products, counting those already saved to your store.`} />
      ) : null}
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
            createControlVisible={createControlVisible}
          />
        ))}
      </div>
      <FieldError issues={issues} field="products" />
    </div>
  )
}
