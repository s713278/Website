import { useEffect, useMemo, useRef, useState, type RefObject, type ToggleEvent } from 'react'
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
import { isPendingId } from '../../lib/onboarding-pending-id'
import { StepNotice } from './AccessNotice'
import {
  selectCatalogPolicy,
  selectCategoryLimitReached,
  selectProductLimit,
  selectProductLimitReached,
  useOnboardingStore,
} from '../../store/onboarding-store'
import { ONBOARDING_CONFIG, type ValidationIssue } from '../../types/onboarding'
import { AuthorCategoryForm, AuthorProductForm } from './CatalogAuthoring'
import { CatalogError, CatalogLoading, CategoryPanel, ChoiceCard, choiceGrid, FieldError, FieldLabel, LoadMoreButton, type RequestConfirmation } from './StepPrimitives'

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

/**
 * A catalog list shown one set of `size` at a time. A choice added after the list mounted that
 * no loaded page holds (an authored entry) leads, newest first, so it shows at once however many
 * choices were already saved. What the vendor had already chosen when the list mounted follows
 * and keeps its place, so a saved choice shows without paging and never jumps when its own page
 * arrives. A ticked card from a loaded page stays where it is. Show more reveals the next set,
 * reading the next page only when the loaded items run short.
 */
function useCatalogSets<T extends { id: number }>({ items, chosen, size, lastPage, loadingMore, loadMore, resetKey, matches, endFocusRef }: {
  items: T[]
  chosen: T[]
  size: number
  lastPage: boolean
  loadingMore: boolean
  loadMore: () => void
  /** A change (a new search) starts again from the first set. */
  resetKey: string
  matches: (item: T) => boolean
  /** Takes focus when a press reveals no card and its button leaves with the list's end. */
  endFocusRef?: RefObject<HTMLElement | null>
}) {
  const [leading] = useState(chosen)
  const [shown, setShown] = useState({ key: resetKey, count: size })
  const [focusAt, setFocusAt] = useState<{ key: string; index: number; hadFocus: boolean } | null>(null)
  // A new search drops a pending press, so returning to the old one cannot focus a late card.
  if (focusAt && focusAt.key !== resetKey) setFocusAt(null)
  const chosenIds = new Set(chosen.map((item) => item.id))
  // A dropped pending entry no longer exists anywhere, so it leaves; a real reference stays.
  const pinned = leading.filter((item) => !isPendingId(item.id) || chosenIds.has(item.id))
  const itemIds = new Set(items.map((item) => item.id))
  const leadingIds = new Set(leading.map((item) => item.id))
  const added = chosen.filter((item) => !itemIds.has(item.id) && !leadingIds.has(item.id)).reverse()
  const all = appendMissingReferenceItems(appendMissingReferenceItems(added, pinned), items).filter(matches)
  const count = shown.key === resetKey ? shown.count : size
  const hasMore = all.length > count || !lastPage
  /** `hadFocus`: the button held focus as it was pressed (a tap on iOS Safari never focuses it). */
  const showMore = (pressed: boolean, hadFocus = false) => {
    if (!hasMore) return
    // The first card this press reveals; a search with nothing shown yet focuses its first match.
    if (pressed) setFocusAt({ key: resetKey, index: Math.min(count, all.length), hadFocus })
    setShown({ key: resetKey, count: count + size })
    if (all.length < count + size && !lastPage) loadMore()
  }
  const focusIndex = focusAt?.key === resetKey ? focusAt.index : null
  const revealed = focusIndex !== null && all.length > focusIndex
  // A press is settled once its card shows or its read ends without one; a card that mounts
  // there later must not take focus. Without a card, focus stays on the button if it remains.
  const settled = focusIndex !== null && (revealed || !loadingMore)
  // Only focus the button lost as it left may move; a tap that never focused it leaves the page be.
  const hadFocus = focusAt?.hadFocus === true
  useEffect(() => {
    if (!settled) return
    setFocusAt(null)
    if (!revealed && hadFocus && document.activeElement === document.body) endFocusRef?.current?.focus()
  }, [settled, revealed, hadFocus, endFocusRef])
  return {
    /** Key the Show more control by this, so a new list brings the button back. */
    key: resetKey,
    visible: all.slice(0, count),
    hasMore,
    showMore,
    /** The first card a pending press reveals; it takes focus as it mounts. */
    focusIndex,
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

export function BusinessStep({ issues, onUseSample: offerSample, readOnly = false }: Omit<CatalogStepProps, 'confirm'> & {
  /** A submitted store: the saved type stays put, but the list can still be browsed. */
  readOnly?: boolean
}) {
  const draft = useOnboardingStore((state) => state.draft)
  // A locked store keeps its catalog source, so the sample switch is not offered.
  const onUseSample = readOnly ? undefined : offerSample
  const changeBusinessType = useOnboardingStore((state) => state.changeBusinessType)
  const references = useBusinessTypeReferences(draft.catalogSource)
  const selected = draft.business.businessType
  const referenceIds = new Set(references.items.map((item) => item.id))
  const sets = useCatalogSets({
    items: references.items,
    chosen: selected ? [selected] : [],
    size: ONBOARDING_CONFIG.businessTypePageSize,
    lastPage: references.lastPage,
    loadingMore: references.loadingMore,
    loadMore: references.loadMore,
    resetKey: `${draft.catalogSource}:${references.committedQuery}`,
    // The server filters its own pages; a chosen type it did not return must match too.
    matches: (item) => referenceIds.has(item.id) ||
      !references.committedQuery ||
      item.name.toLowerCase().includes(references.committedQuery),
  })
  const items = sets.visible
  const choicesRef = useRef<HTMLDivElement>(null)
  // A locked card cannot take focus, so a press on a read-only step lands on the list instead.
  useEffect(() => {
    if (readOnly && sets.focusIndex !== null) choicesRef.current?.focus()
  }, [readOnly, sets.focusIndex])
  const initialError = Boolean(references.error && !references.items.length)
  const incrementalError = Boolean(references.error && references.items.length)
  const showInitialSkeleton = references.loading || (
    references.searchPending && !items.length
  )

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
            ref={choicesRef}
            id="business-type"
            role="region"
            aria-label="Business type choices"
            tabIndex={-1}
            className="outline-none"
            aria-busy={references.loading || references.loadingMore}
          >
            {showInitialSkeleton ? <CatalogLoading size="choice" /> : null}
            {items.length ? (
              <fieldset disabled={readOnly} className={cn(choiceGrid, 'min-w-0 border-0 p-0', showInitialSkeleton && 'mt-3')}>
                {items.map((item, index) => (
                  <ChoiceCard
                    key={item.id}
                    autoFocus={index === sets.focusIndex}
                    selected={selected?.id === item.id}
                    title={item.name}
                    leading={<BusinessTypeIcon key={item.icon ?? `fallback-${item.id}`} src={item.icon} />}
                    onClick={() => chooseBusinessType(item)}
                  />
                ))}
              </fieldset>
            ) : null}
            {references.loadingMore && !references.searchPending ? (
              <div className="mt-3">
                <CatalogLoading count={3} size="choice" />
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
            {sets.hasMore && items.length ? (
              <div className="mt-3">
                <LoadMoreButton
                  key={sets.key}
                  label="Show more business types"
                  disabled={references.loading || references.loadingMore || references.searchPending || Boolean(references.error)}
                  onClick={sets.showMore}
                />
              </div>
            ) : null}
            {references.loadingMore || (!sets.hasMore && items.length) ? (
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

/** How long a refused tap's note stays up. It answers one tap, so it must not outstay it. */
const REFUSAL_NOTE_MS = 4000

/** A note that clears itself, counted from the latest time it was shown. */
function useRefusalNote() {
  const [note, setNote] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const show = (next: string | null) => {
    window.clearTimeout(timer.current)
    setNote(next)
    if (next) timer.current = window.setTimeout(() => setNote(null), REFUSAL_NOTE_MS)
  }
  return [note, show] as const
}

export function CategoryStep({ issues, confirm, onUseSample }: CatalogStepProps) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const removePendingEntry = useOnboardingStore((state) => state.removePendingEntry)
  const [search, setSearch] = useState('')
  const [blocked, setBlocked] = useRefusalNote()
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
  const searchRef = useRef<HTMLInputElement>(null)
  const sets = useCatalogSets({
    items: references.items,
    chosen: draft.categories,
    size: ONBOARDING_CONFIG.categoryPageSize,
    lastPage: references.lastPage,
    loadingMore: references.loadingMore,
    loadMore: references.loadMore,
    resetKey: `${draft.catalogSource}:${businessTypeId}:${query}`,
    matches: (item) => item.name.toLowerCase().includes(query),
    // A search that runs out leaves the vendor to refine it.
    endFocusRef: searchRef,
  })
  const loadedItems = sets.visible

  const toggle = (category: (typeof draft.categories)[number]) => {
    const choice = catalogChoiceState(draft.categories, category.id)
    if (!choice.chosen && categoryLimitReached) return
    if (choice.chosen && isCategoryAssigned(category.id)) {
      setBlocked(
        `${category.name} is saved, so it can’t be removed here.`,
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
      {blocked ? <StepNotice tone="info" message={blocked} /> : null}
      <div>
        <FieldLabel htmlFor="category-search">Search category</FieldLabel>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-3.5 left-3 size-4 text-[var(--ob-ink-soft)]" />
          <input
            ref={searchRef}
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
      {references.loading ? <CatalogLoading size="choice" /> : null}
      {references.error && draft.catalogSource === 'account' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
      {!references.loading && !references.error && !loadedItems.length ? (
        <EmptyState title="No categories found" description={search ? 'Try another search.' : 'This business type has no available categories.'} />
      ) : null}
      {loadedItems.length ? (
        <div id="categories" className={choiceGrid}>
          {loadedItems.map((category, index) => {
            const choice = catalogChoiceState(draft.categories, category.id)
            const atLimit = !choice.chosen && categoryLimitReached
            const onStore = choice.chosen && isCategoryAssigned(category.id)
            return (
              <ChoiceCard
                key={category.id}
                autoFocus={index === sets.focusIndex}
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
      {references.loadingMore ? <CatalogLoading count={3} size="choice" /> : null}
      <FieldError issues={issues} field="categories" />
      {sets.hasMore ? (
        <LoadMoreButton
          key={sets.key}
          label="Show more categories"
          // A search filters loaded pages, so scrolling past few matches could read the whole catalog.
          pressOnly={Boolean(query)}
          disabled={references.loading || references.loadingMore || Boolean(references.error)}
          onClick={sets.showMore}
        />
      ) : null}
      {references.loadingMore || (!sets.hasMore && loadedItems.length) ? (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {references.loadingMore ? 'Loading more categories.' : 'All categories are loaded.'}
        </p>
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
  // A closed panel shows only its selected count, which the draft holds, so its products
  // are read when it is first opened and kept for every reopening after that.
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  const references = useProductReferences(draft.catalogSource, categoryId, opened)
  const [search, setSearch] = useState('')
  const [blocked, setBlocked] = useRefusalNote()
  const isProductAssigned = useOnboardingStore((state) => state.isProductAssigned)
  const productLimitReached = useOnboardingStore(selectProductLimitReached)
  const query = search.trim().toLowerCase()
  const selectedForCategory = draft.products.filter((item) => item.categoryId === categoryId)
  const searchRef = useRef<HTMLInputElement>(null)
  const sets = useCatalogSets<ProductReference>({
    items: references.items,
    chosen: selectedForCategory,
    size: ONBOARDING_CONFIG.productPageSize,
    lastPage: references.lastPage,
    loadingMore: references.loadingMore,
    loadMore: references.loadMore,
    resetKey: `${draft.catalogSource}:${query}`,
    matches: (item) => item.name.toLowerCase().includes(query),
    // A search that runs out leaves the vendor to refine it.
    endFocusRef: searchRef,
  })
  const items = sets.visible

  const toggle = (product: ProductReference) => {
    const choice = catalogChoiceState(draft.products, product.id)
    if (choice.chosen && isProductAssigned(product.id)) {
      setBlocked(
        `${product.name} is saved, so it can’t be removed here. You can set it inactive in the next step.`,
      )
      return
    }
    // The step states the limit above every category, so a refused pick adds no second copy.
    if (!choice.chosen && productLimitReached) return
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
              ref={searchRef}
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
        {blocked ? <StepNotice tone="info" message={blocked} /> : null}
        {references.loading ? <CatalogLoading size="product" /> : null}
        {references.error && draft.catalogSource === 'account' ? <CatalogError message={references.error} onRetry={references.retry} onUseSample={onUseSample} /> : null}
        {!references.loading && !references.error && !items.length ? (
          <EmptyState title="No products found" description={search ? 'Try another search.' : 'No products are currently listed for this category.'} />
        ) : null}
        {items.length ? (
          <div className={choiceGrid}>
            {items.map((product, index) => {
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
                  autoFocus={index === sets.focusIndex}
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
        {references.loadingMore ? <CatalogLoading count={3} size="product" /> : null}
        {sets.hasMore ? (
          <LoadMoreButton
            key={sets.key}
            label="Show more products"
            // A search filters loaded pages, so scrolling past few matches could read the whole catalog.
            pressOnly={Boolean(query)}
            disabled={references.loading || references.loadingMore || Boolean(references.error)}
            onClick={sets.showMore}
          />
        ) : null}
        {references.loadingMore || (!sets.hasMore && items.length) ? (
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {references.loadingMore ? 'Loading more products.' : 'All products are loaded.'}
          </p>
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
