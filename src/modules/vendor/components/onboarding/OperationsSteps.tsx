import { useEffect, useMemo, useRef } from 'react'
import {
  BanknoteIcon,
  LandmarkIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, EmptyState, Input } from '@/shared/components/ui'
import { isAccountSkuId, localSkuId } from '../../lib/onboarding-sku-id'
import { useSingleOpen } from '../../hooks/use-single-open'
import {
  selectProjectedSkuTotal,
  selectSkuLimit,
  selectSkuLimitReached,
  selectStoreIsSubmitted,
  useOnboardingStore,
} from '../../store/onboarding-store'
import type {
  DeliveryDraft,
  DraftSku,
  PaymentDetailsRuntime,
  PaymentType,
  SchedulingStrategy,
  SelectedProduct,
  ValidationIssue,
  Weekday,
} from '../../types/onboarding'
import {
  defaultUnitForMeasurement,
  expectedMeasurementFor,
  measurementFromProduct,
  productMeasurementSummary,
  reconcileSkuToProductMeasurement,
  unitsForMeasurement,
  type MeasurementCatalog,
} from '../../lib/onboarding-measurement'
import { CategoryPanel, FieldError, Hint, StepSection } from './StepPrimitives'

const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
]

const PAYMENT_LABELS: Record<PaymentType, { title: string; description: string }> = {
  PRE_PAID: { title: 'UPI', description: 'Collect via PhonePe, GPay, Paytm, etc.' },
  ONLINE: { title: 'Bank Account', description: 'Share account details for NEFT / IMPS transfers.' },
  CASH_ON_DELIVERY: { title: 'Cash on Delivery', description: 'Customer pays when the order arrives.' },
}

function PaymentMethodIcon({ type }: { type: PaymentType }) {
  const Icon = type === 'PRE_PAID'
    ? SmartphoneIcon
    : type === 'ONLINE'
      ? LandmarkIcon
      : BanknoteIcon
  return (
    <span className="grid size-9 shrink-0 place-items-center text-primary">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  )
}

function parseDraftNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function makeSku(
  product: { id: number; name: string; measurementId: number | null; measurementName: string | null },
  skus: DraftSku[],
  catalog: MeasurementCatalog,
): DraftSku {
  const measurementType = measurementFromProduct(product.measurementId, product.measurementName, catalog)
  return {
    id: localSkuId(product.id, skus),
    productId: product.id,
    // Used locally for previews; the backend derives display details from the product.
    name: product.name,
    description: '',
    skuType: 'ITEM',
    measurementType,
    unit: defaultUnitForMeasurement(measurementType, catalog),
    // Every new size starts blank so the vendor fills it in, rather than keeping a guessed 1.
    quantity: null,
    listPrice: null,
    salePrice: null,
    active: true,
    // No Step 6 control sets these any more; they keep the backend's established
    // compatibility default so a created size still satisfies the current contract.
    homeDelivery: true,
    storePickup: true,
  }
}

/**
 * A size's visible heading. It is derived from quantity and unit rather than the hidden
 * name, and falls back to a neutral sequential label while a new or cleared size cannot yet
 * be identified.
 */
function skuHeading(sku: DraftSku, index: number): string {
  return sku.quantity != null && sku.quantity > 0 && sku.unit.trim()
    ? `${sku.quantity} ${sku.unit}`
    : `Size ${index + 1}`
}

function formatSkuPrice(value: number | null): string {
  if (value == null) return '—'
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`
}

function SkuStatusSwitch({
  heading,
  active,
  disabled = false,
  onChange,
}: {
  heading: string
  active: boolean
  disabled?: boolean
  onChange?: (active: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${heading} status: ${active ? 'active' : 'inactive'}`}
      title={disabled ? 'Size status changes are temporarily unavailable' : `${active ? 'Deactivate' : 'Activate'} ${heading}`}
      disabled={disabled}
      onClick={() => onChange?.(!active)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors max-[30rem]:h-6 max-[30rem]:w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ob-brand-soft)] disabled:cursor-not-allowed',
        active ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 size-5 rounded-full bg-white max-[30rem]:size-4 shadow-sm transition-[left,right] dark:bg-slate-100',
          active ? 'right-1' : 'left-1',
        )}
      />
    </button>
  )
}

/**
 * A bare red cross with a fixed hit area, so the header and every row stay aligned. It is
 * always rendered; `inert` marks a product's only size, which cannot be removed.
 */
function SkuRemoveButton({
  heading,
  active,
  disabled = false,
  inert = false,
  onClick,
}: {
  heading: string
  active: boolean
  disabled?: boolean
  inert?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Remove ${heading}`}
      title={inert ? undefined : disabled ? 'Removing sizes is temporarily unavailable' : `Remove ${heading}`}
      disabled={disabled || inert}
      onClick={onClick}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ob-brand)] disabled:cursor-not-allowed max-[30rem]:w-7',
        active && !disabled
          ? 'text-red-500 hover:text-red-600 dark:hover:text-red-300'
          : 'text-slate-400 dark:text-slate-500',
        inert && 'pointer-events-none opacity-40',
      )}
    >
      <XIcon className="size-4" strokeWidth={2.2} aria-hidden="true" />
    </button>
  )
}

/**
 * The six columns every size row shares: quantity, unit, MRP, discounted price, status,
 * remove. The last two cells carry fixed widths so the header row and every size row
 * line up even though each is its own grid.
 */
const SKU_ROW_GRID =
  'grid grid-cols-[minmax(3.4rem,.7fr)_minmax(3.6rem,.7fr)_minmax(4rem,.9fr)_minmax(4rem,.9fr)_auto_auto] items-center gap-1.5 max-[30rem]:grid-cols-[minmax(2.5rem,.8fr)_minmax(3rem,.9fr)_minmax(2.9rem,1fr)_minmax(2.9rem,1fr)_auto_auto] max-[30rem]:gap-1'

const skuFieldClass =
  'h-9 w-full min-w-0 rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] px-2 text-[0.8rem] text-[var(--ob-ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--ob-pending)] focus:border-[var(--ob-brand)] focus:ring-2 focus:ring-[var(--ob-brand-soft)] aria-invalid:border-destructive max-[30rem]:px-1.5 max-[30rem]:text-xs'

/** Phone widths hide the number spinners; the inputs are too narrow to spare their width. */
const skuNumberClass = cn(skuFieldClass, 'max-[30rem]:[appearance:textfield] max-[30rem]:[&::-webkit-inner-spin-button]:appearance-none max-[30rem]:[&::-webkit-outer-spin-button]:appearance-none')

/** The fields of a size row, in column order. Each error renders directly below its own input. */
const SKU_FIELDS = [
  { key: 'quantity', label: 'Quantity' },
  { key: 'unit', label: 'Unit' },
  { key: 'list-price', label: 'MRP (₹)' },
  { key: 'sale-price', label: 'Discounted price (₹)' },
] as const

type SkuGroupId = number | 'other'

function SkuHeaderRow() {
  return (
    <div aria-hidden="true" className={cn(SKU_ROW_GRID, 'mb-1.5 px-0.5 text-[0.7rem] leading-tight text-[var(--ob-ink-soft)]')}>
      <span>Qty</span>
      <span>Unit</span>
      <span>MRP</span>
      <span>Discounted price</span>
      <span className="w-12 text-center max-[30rem]:w-10">On</span>
      <span className="w-9 max-[30rem]:w-7" />
    </div>
  )
}

/**
 * A submitted account size, shown in the same columns as an editable row but as text.
 * Quantity and unit share one cell so the size reads as one value ("1 L").
 */
function SkuReadOnlyRow({ sku, heading }: { sku: DraftSku; heading: string }) {
  return (
    <div className={cn(SKU_ROW_GRID, 'min-h-9 px-0.5 text-[0.8rem] text-[var(--ob-ink)]', !sku.active && 'opacity-55')}>
      <span className="col-span-2 truncate font-semibold">{`${sku.quantity ?? '—'} ${sku.unit}`}</span>
      {/* The header row is hidden from assistive tech, so each price names itself. */}
      <span className="truncate"><span className="sr-only">MRP </span><span>{formatSkuPrice(sku.listPrice)}</span></span>
      <span className="truncate"><span className="sr-only">Discounted price </span><span>{formatSkuPrice(sku.salePrice)}</span></span>
      <SkuStatusSwitch heading={heading} active={sku.active} disabled />
      <SkuRemoveButton heading={heading} active={sku.active} disabled />
    </div>
  )
}

export function SkuStep({ issues }: { issues: ValidationIssue[] }) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const measurementCatalog = useOnboardingStore((state) => state.measurementCatalog)
  const productMeasurementCatalog = useOnboardingStore((state) => state.productMeasurementCatalog)
  const skuLimit = useOnboardingStore(selectSkuLimit)
  const projectedSkus = useOnboardingStore(selectProjectedSkuTotal)
  const skuLimitReached = useOnboardingStore(selectSkuLimitReached)
  const storeIsSubmitted = useOnboardingStore(selectStoreIsSubmitted)
  // Products are grouped under their category; any product whose category is not in the
  // draft lands in a trailing "Other products" group rather than disappearing.
  const hasOrphanProducts = draft.products.some(
    (product) => !draft.categories.some((category) => category.id === product.categoryId),
  )
  const groupIds = useMemo<SkuGroupId[]>(
    () => [...draft.categories.map((category) => category.id), ...(hasOrphanProducts ? ['other' as const] : [])],
    [draft.categories, hasOrphanProducts],
  )
  const { openId, setOpenId, onToggle } = useSingleOpen<SkuGroupId>(groupIds)

  // Scaffold a size for any product without one, and reconcile every existing size to its
  // product's measurement — a size resumed from the account or restored from persistence can
  // carry a measurement that drifted off its product, and Step 6 no longer offers a control
  // to fix it by hand. `reconcileSkuToProductMeasurement` returns the same size when nothing
  // needs to change, so this is idempotent and cannot loop this effect.
  //
  // Submitted stores add sizes explicitly after approval. Do not scaffold phantom rows,
  // consume plan capacity on a read, or reconcile already saved sizes behind their backs.
  //
  // Otherwise, deliberately no `invalidateFrom`. Neither scaffolding nor reconciling is an
  // edit the vendor made, and invalidating from Step 6 would drop `furthestVisitedStep` to 6
  // and filter `completedSteps`. A vendor who resumed at Step 9 with one unpriced product
  // left over (the exact case `furthestSavedStep` exists to protect) would lose Steps 7-10
  // just by opening Step 6 to look at it.
  useEffect(() => {
    if (storeIsSubmitted) return
    const productById = new Map(draft.products.map((product) => [product.id, product]))
    const missingSize = draft.products.some((product) => !draft.skus.some((sku) => sku.productId === product.id))
    const driftedSize = draft.skus.some((sku) => {
      const product = productById.get(sku.productId)
      return product ? reconcileSkuToProductMeasurement(sku, product, measurementCatalog) !== sku : false
    })
    if (!missingSize && !driftedSize) return
    updateDraft((current) => {
      const currentProductById = new Map(current.products.map((product) => [product.id, product]))
      const skus = current.skus.map((sku) => {
        const product = currentProductById.get(sku.productId)
        return product ? reconcileSkuToProductMeasurement(sku, product, measurementCatalog) : sku
      })
      for (const product of current.products) {
        if (!skus.some((sku) => sku.productId === product.id)) skus.push(makeSku(product, skus, measurementCatalog))
      }
      return { ...current, skus }
    })
  }, [draft.products, draft.skus, updateDraft, measurementCatalog, storeIsSubmitted])

  // A problem inside a closed category would otherwise be reported with nothing on
  // screen to fix. Only one panel can be open, so open the category holding the first
  // product that has one (or "Other products" for a product outside the chosen categories).
  // Keyed on `issues` alone: edits between Continue presses must not move the vendor,
  // and a list that only shrinks as fields are fixed must not close the panel in use.
  const previousIssues = useRef<ValidationIssue[]>([])
  useEffect(() => {
    const previous = previousIssues.current
    previousIssues.current = issues
    const arrived = issues.some(
      (item) => !previous.some((old) => old.field === item.field && old.message === item.message),
    )
    if (!arrived) return
    const { categories, products, skus } = useOnboardingStore.getState().draft
    const faulty = products.find(
      (product) =>
        issues.some((item) => item.field === `product-${product.id}`) ||
        skus.some(
          (sku) => sku.productId === product.id && issues.some((item) => item.field.startsWith(`sku-${sku.id}`)),
        ),
    )
    if (!faulty) return
    setOpenId(categories.some((category) => category.id === faulty.categoryId) ? faulty.categoryId : 'other')
  }, [issues, setOpenId])

  const updateSku = (skuId: string, patch: Partial<DraftSku>) => updateDraft(
    (current) => ({
      ...current,
      skus: current.skus.map((sku) => sku.id === skuId ? { ...sku, ...patch } : sku),
    }),
    6,
  )

  const removeSku = (sku: DraftSku) => {
    const productSkuCount = draft.skus.filter((item) => item.productId === sku.productId).length
    if (productSkuCount <= 1) return

    updateDraft(
      (current) => {
        const remainingForProduct = current.skus.filter((item) => item.productId === sku.productId)
        if (remainingForProduct.length <= 1) return current
        return { ...current, skus: current.skus.filter((item) => item.id !== sku.id) }
      },
      6,
    )
    // The removed row took focus with it; keep the vendor in this product rather than
    // dropping focus to the page. "+ Size" is the natural next action, unless the plan
    // limit has disabled it, in which case a remaining size's quantity is next best.
    const fallbackSku = draft.skus.find((item) => item.productId === sku.productId && item.id !== sku.id)
    window.setTimeout(() => {
      const addButton = document.getElementById(`sku-add-${sku.productId}`)
      if (addButton instanceof HTMLButtonElement && !addButton.disabled) addButton.focus()
      else if (fallbackSku) document.getElementById(`sku-${fallbackSku.id}-quantity`)?.focus()
    }, 0)
  }

  if (!draft.products.length) {
    return <EmptyState title="Choose products first" description="Return to Step 5 to build your starting catalog." />
  }

  const renderSkuRow = (
    product: SelectedProduct,
    sku: DraftSku,
    index: number,
    productSkus: DraftSku[],
    expectedMeasurement: ReturnType<typeof expectedMeasurementFor>,
  ) => {
    const heading = skuHeading(sku, index)
    // Product-qualified so two products' "1 L" sizes stay distinguishable.
    const groupLabel = `${product.name}, ${heading} size`
    // Saved sizes stay locked after submission and use the read-only row; approved vendors
    // can still fill and remove the new sizes they add before saving them. The deployed
    // PATCH still fails for active changes in both approval states, so these controls
    // display the current state without suggesting that the unavailable write works.
    if (storeIsSubmitted && isAccountSkuId(sku.id)) {
      return (
        <fieldset key={sku.id} disabled className="min-w-0 border-0 p-0" aria-label={groupLabel}>
          <SkuReadOnlyRow sku={sku} heading={heading} />
        </fieldset>
      )
    }
    const measurement = expectedMeasurement ?? sku.measurementType
    const inputId = (key: string) => `sku-${sku.id}-${key}`
    const issueFor = (key: string) => issues.find((item) => item.field === inputId(key))?.message
    const fieldA11y = (key: (typeof SKU_FIELDS)[number]['key']) => ({
      id: inputId(key),
      'aria-label': SKU_FIELDS.find((field) => field.key === key)?.label,
      'aria-invalid': issueFor(key) ? true : undefined,
      'aria-describedby': issueFor(key) ? `${inputId(key)}-error` : undefined,
    })
    // Row-level issues (an unrecognised ID, measurement drift) name the size itself, not
    // one of its inputs, so they describe the whole row and are the focus target for it.
    const rowId = `sku-${sku.id}`
    const rowIssue = issues.find((item) => item.field === rowId)?.message
    // A field's error sits directly under its own input, so only that column grows.
    const fieldError = (key: (typeof SKU_FIELDS)[number]['key']) => {
      const message = issueFor(key)
      return message ? (
        <p id={`${inputId(key)}-error`} className="mt-1 text-xs font-medium break-words text-destructive max-[30rem]:text-[0.65rem] max-[30rem]:leading-tight max-[30rem]:wrap-normal">{message}</p>
      ) : null
    }
    return (
      <fieldset
        key={sku.id}
        id={rowId}
        className="min-w-0 border-0 p-0"
        aria-label={groupLabel}
        aria-describedby={rowIssue ? `${rowId}-error` : undefined}
      >
        <div className={cn(SKU_ROW_GRID, 'items-start', !sku.active && 'opacity-55')}>
          <div className="min-w-0">
            <input
              {...fieldA11y('quantity')}
              type="number"
              min={measurement === 'COUNT' ? '1' : '0.000001'}
              step={measurement === 'COUNT' ? '1' : 'any'}
              placeholder="Qty"
              value={sku.quantity ?? ''}
              onChange={(event) => updateSku(sku.id, { quantity: parseDraftNumber(event.target.value) })}
              onWheel={(event) => event.currentTarget.blur()}
              className={skuNumberClass}
            />
            {fieldError('quantity')}
          </div>
          <div className="min-w-0">
            <select
              {...fieldA11y('unit')}
              value={sku.unit}
              onChange={(event) => updateSku(sku.id, { unit: event.target.value })}
              className={cn(skuFieldClass, 'pr-1')}
            >
              {unitsForMeasurement(measurement, measurementCatalog).map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            {fieldError('unit')}
          </div>
          <div className="min-w-0">
            <input
              {...fieldA11y('list-price')}
              type="number"
              min="1"
              step="1"
              placeholder="MRP ₹"
              value={sku.listPrice ?? ''}
              onChange={(event) => updateSku(sku.id, { listPrice: parseDraftNumber(event.target.value) })}
              onWheel={(event) => event.currentTarget.blur()}
              className={skuNumberClass}
            />
            {fieldError('list-price')}
          </div>
          <div className="min-w-0">
            <input
              {...fieldA11y('sale-price')}
              type="number"
              min="1"
              step="1"
              placeholder="Discounted ₹"
              value={sku.salePrice ?? ''}
              onChange={(event) => updateSku(sku.id, { salePrice: parseDraftNumber(event.target.value) })}
              onWheel={(event) => event.currentTarget.blur()}
              className={skuNumberClass}
            />
            {fieldError('sale-price')}
          </div>
          {/* Input height, so the switch and cross stay level with the inputs when an error grows a column. */}
          <div className="flex h-9 items-center">
            <SkuStatusSwitch heading={heading} active={sku.active} onChange={(active) => updateSku(sku.id, { active })} />
          </div>
          <SkuRemoveButton
            heading={heading}
            active={sku.active}
            inert={productSkus.length <= 1}
            onClick={() => removeSku(sku)}
          />
        </div>
        {rowIssue ? (
          <p id={`${rowId}-error`} className="mt-1 px-0.5 text-xs font-medium text-destructive">{rowIssue}</p>
        ) : null}
      </fieldset>
    )
  }

  const renderProduct = (product: SelectedProduct) => {
    const productSkus = draft.skus.filter((sku) => sku.productId === product.id)
    // The one measurement every size of this product must carry. Sources the unit and
    // quantity controls; `sku.measurementType` is the fallback only until the reconcile
    // effect has synced it to the product.
    const expectedMeasurement = expectedMeasurementFor(product, measurementCatalog)
    // The same trustworthy product metadata Step 5 shows, resolved only from the product's
    // own measurement — never guessed or borrowed. Keeps the product-owned measurement and
    // its valid units in view while the vendor prices sizes.
    const measurementSummary = productMeasurementSummary(product, productMeasurementCatalog)
    const unitSummary = measurementSummary.units.length
      ? `${measurementSummary.units.join(', ')}${measurementSummary.additionalUnitCount ? ` +${measurementSummary.additionalUnitCount}` : ''}`
      : 'Units unavailable'
    return (
      <div
        key={product.id}
        id={`product-${product.id}`}
        role="group"
        aria-labelledby={`sku-product-${product.id}`}
        className="overflow-x-auto rounded-xl border border-[var(--ob-line)] bg-[var(--ob-canvas)] p-3 max-[30rem]:p-2"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 id={`sku-product-${product.id}`} className="truncate font-display text-sm font-semibold text-[var(--ob-ink)]">{product.name}</h4>
            <p className="mt-0.5 text-[0.7rem] leading-4 text-[var(--ob-ink-soft)]">
              {measurementSummary.measurement ? `${measurementSummary.measurement} · ${unitSummary}` : 'Measurement unavailable'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            id={`sku-add-${product.id}`}
            aria-label={`Add another size to ${product.name}`}
            disabled={skuLimitReached}
            onClick={() => {
              if (skuLimitReached) return
              updateDraft((current) => ({ ...current, skus: [...current.skus, makeSku(product, current.skus, measurementCatalog)] }), 6)
            }}
            className="shrink-0 px-2 font-medium text-[var(--ob-brand)] hover:bg-[var(--ob-brand-soft)] hover:text-[var(--ob-brand)]"
          >
            + Size
          </Button>
        </div>
        <FieldError issues={issues} field={`product-${product.id}`} />
        <SkuHeaderRow />
        <div className="space-y-2">
          {productSkus.map((sku, index) => renderSkuRow(product, sku, index, productSkus, expectedMeasurement))}
        </div>
      </div>
    )
  }

  const groups: Array<{ id: SkuGroupId; name: string; products: SelectedProduct[] }> = [
    ...draft.categories.map((category) => ({
      id: category.id,
      name: category.name,
      products: draft.products.filter((product) => product.categoryId === category.id),
    })),
    ...(hasOrphanProducts
      ? [{
          id: 'other' as const,
          name: 'Other products',
          products: draft.products.filter(
            (product) => !draft.categories.some((category) => category.id === product.categoryId),
          ),
        }]
      : []),
  ]

  return (
    <div className="space-y-5">
      {/* Step-wide size issues (the plan limit, a failed save) have no single input, so the
          usage line carries them and is the focus target for field `skus`. */}
      <div id="skus" aria-describedby={issues.some((item) => item.field === 'skus') ? 'skus-error' : undefined}>
        <p className={cn('text-sm', skuLimitReached ? 'font-medium text-amber-800 dark:text-amber-200' : 'text-[var(--ob-ink-soft)]')}>
          {projectedSkus} of {skuLimit} sizes used
          {skuLimitReached ? <> · You’ve reached your plan’s limit, counting sizes already saved to your store.</> : null}
        </p>
        <FieldError issues={issues} field="skus" />
      </div>
      <div>
        <div className="space-y-3">
          {groups.map((group) => {
            const count = group.products.length
            const meta = count ? `${count} ${count === 1 ? 'product' : 'products'}` : 'No products'
            return (
              <CategoryPanel
                key={group.id}
                id={`sku-category-${group.id}`}
                open={openId === group.id}
                onToggle={onToggle(group.id)}
                name={group.name}
                meta={meta}
                count={count}
              >
                {count ? (
                  <div className="space-y-3">{group.products.map(renderProduct)}</div>
                ) : (
                  <p className="text-xs text-[var(--ob-ink-soft)]">No products in this category.</p>
                )}
              </CategoryPanel>
            )
          })}
        </div>
        {openId === null ? (
          <p className="mt-3 text-center text-xs text-[var(--ob-ink-soft)]">Tap a category to set prices.</p>
        ) : null}
      </div>
    </div>
  )
}

function RadioCard({
  name,
  value,
  checked,
  title,
  description,
  onChange,
}: {
  name: string
  value: string
  checked: boolean
  title: string
  description: string
  onChange: () => void
}) {
  return (
    <label className={cn(
      'relative block cursor-pointer overflow-hidden rounded-xl border p-3 outline-none transition-[border-color,background-color] focus-within:ring-3 focus-within:ring-[var(--ob-brand-soft)]',
      checked
        ? 'border-[var(--ob-brand)] bg-[var(--ob-brand-soft)]'
        : 'border-[var(--ob-line)] bg-[var(--ob-sheet)] hover:border-[var(--ob-brand)]/45 hover:bg-[var(--ob-brand-soft)]/40',
    )}>
      <span className="flex items-start gap-3">
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1" />
        <span>
          <strong className="block text-sm text-[var(--ob-ink)]">{title}</strong>
          <span className="mt-1 block text-xs leading-5 text-[var(--ob-ink-soft)]">{description}</span>
        </span>
      </span>
    </label>
  )
}

/** Step 7 issue fields that name a group of inputs rather than one input. */
const SCHEDULE_GROUP_FIELDS = ['fixed-window', 'customer-date-range', 'predefined-days', 'prep-range'] as const

export function DeliveryStep({ issues }: { issues: ValidationIssue[] }) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const delivery = draft.delivery
  const hasHomeDelivery = delivery.fulfillmentType !== 'STORE_PICKUP'

  const updateDelivery = (updater: (delivery: DeliveryDraft) => DeliveryDraft) => updateDraft(
    (current) => ({ ...current, delivery: updater(current.delivery) }),
    7,
  )

  const setFulfillment = (fulfillmentType: DeliveryDraft['fulfillmentType']) => updateDraft(
    (current) => ({
      ...current,
      delivery: { ...current.delivery, fulfillmentType },
    }),
    7,
  )

  const issueMessage = (field: string) => issues.find((item) => item.field === field)?.message
  const describedBy = (field: string) => issueMessage(field) ? `${field}-error` : undefined

  const addSlot = () => updateDelivery((current) => ({
    ...current,
    slots: [...current.slots, { id: `draft-slot-${Math.max(0, ...current.slots.map((slot) => Number(slot.id.replace('draft-slot-', '')) || 0)) + 1}`, startTime: '09:00', endTime: '12:00' }],
  }))

  return (
    <div>
      <StepSection id="fulfillment" title="Fulfilment">
        {/* `fulfillment` is the step-wide issue field (a failed save), so the choice group
            carries its message and takes focus for it. */}
        <div
          id="fulfillment"
          aria-describedby={issues.some((item) => item.field === 'fulfillment') ? 'fulfillment-error' : undefined}
          className="grid gap-3 @min-[38rem]:grid-cols-3"
        >
          <RadioCard name="fulfillment" value="HOME_DELIVERY" checked={delivery.fulfillmentType === 'HOME_DELIVERY'} title="Home delivery" description="Deliver orders to customers." onChange={() => setFulfillment('HOME_DELIVERY')} />
          <RadioCard name="fulfillment" value="STORE_PICKUP" checked={delivery.fulfillmentType === 'STORE_PICKUP'} title="Store pickup" description="Customers collect from your store." onChange={() => setFulfillment('STORE_PICKUP')} />
          <RadioCard name="fulfillment" value="BOTH" checked={delivery.fulfillmentType === 'BOTH'} title="Both" description="Let customers choose at checkout." onChange={() => setFulfillment('BOTH')} />
        </div>
        <FieldError issues={issues} field="fulfillment" />
      </StepSection>

      {hasHomeDelivery ? (
        <>
          <StepSection id="delivery-schedule" title="Delivery schedule">
            <div className="grid gap-2 @min-[32rem]:grid-cols-2">
              {([
                ['FIXED_WINDOW', 'Fixed window', 'Deliver within a minimum and maximum number of days.'],
                ['CUSTOMER_SELECT_DATE', 'Customer selects date', 'Let customers choose an exact date within a range.'],
                ['PREDEFINED_DAYS', 'Predefined days', 'Deliver only on selected weekdays.'],
                ['INSTANT', 'Instant', 'Use preparation time and same-day operating hours.'],
              ] as Array<[SchedulingStrategy, string, string]>).map(([value, title, description]) => (
                <RadioCard key={value} name="schedule" value={value} checked={delivery.schedulingStrategy === value} title={title} description={description} onChange={() => updateDelivery((current) => ({ ...current, schedulingStrategy: value }))} />
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-[var(--ob-canvas)] p-4">
              {delivery.schedulingStrategy === 'FIXED_WINDOW' ? (
                <div id="fixed-window" aria-describedby={describedBy('fixed-window')} className="grid gap-3 @min-[32rem]:grid-cols-2">
                  <Input label="Minimum delivery days" type="number" min="0" value={delivery.fixedWindow.minDeliveryDays} onChange={(event) => updateDelivery((current) => ({ ...current, fixedWindow: { ...current.fixedWindow, minDeliveryDays: Number(event.target.value) } }))} />
                  <Input label="Maximum delivery days" type="number" min="1" value={delivery.fixedWindow.maxDeliveryDays} onChange={(event) => updateDelivery((current) => ({ ...current, fixedWindow: { ...current.fixedWindow, maxDeliveryDays: Number(event.target.value) } }))} />
                </div>
              ) : null}
              {delivery.schedulingStrategy === 'CUSTOMER_SELECT_DATE' ? (
                <div id="customer-date-range" aria-describedby={describedBy('customer-date-range')} className="grid gap-3 @min-[38rem]:grid-cols-3">
                  <Input label="Minimum advance days" type="number" min="0" value={delivery.customerSelectDate.minAdvanceBookingDays} onChange={(event) => updateDelivery((current) => ({ ...current, customerSelectDate: { ...current.customerSelectDate, minAdvanceBookingDays: Number(event.target.value) } }))} />
                  <Input label="Maximum advance days" type="number" min="1" value={delivery.customerSelectDate.maxAdvanceBookingDays} onChange={(event) => updateDelivery((current) => ({ ...current, customerSelectDate: { ...current.customerSelectDate, maxAdvanceBookingDays: Number(event.target.value) } }))} />
                  <Input id="customer-cutoff" error={issueMessage('customer-cutoff')} label="Daily cutoff" type="time" value={delivery.customerSelectDate.cutoffTime} onChange={(event) => updateDelivery((current) => ({ ...current, customerSelectDate: { ...current.customerSelectDate, cutoffTime: event.target.value } }))} />
                </div>
              ) : null}
              {delivery.schedulingStrategy === 'PREDEFINED_DAYS' ? (
                <div>
                  <div id="predefined-days" aria-describedby={describedBy('predefined-days')} className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                      const selected = delivery.predefinedDays.days.includes(day.value)
                      return <button key={day.value} type="button" aria-pressed={selected} onClick={() => updateDelivery((current) => ({ ...current, predefinedDays: { ...current.predefinedDays, days: selected ? current.predefinedDays.days.filter((value) => value !== day.value) : [...current.predefinedDays.days, day.value] } }))} className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>{day.label}</button>
                    })}
                  </div>
                  <div className="mt-3 max-w-xs"><Input id="max-orders" error={issueMessage('max-orders')} label="Maximum orders per day" type="number" min="1" value={delivery.predefinedDays.maxOrdersPerDay} onChange={(event) => updateDelivery((current) => ({ ...current, predefinedDays: { ...current.predefinedDays, maxOrdersPerDay: Number(event.target.value) } }))} /></div>
                </div>
              ) : null}
              {delivery.schedulingStrategy === 'INSTANT' ? (
                <div id="prep-range" aria-describedby={describedBy('prep-range')} className="grid gap-3 @min-[32rem]:grid-cols-2">
                  <Input label="Minimum prep minutes" type="number" min="1" value={delivery.instant.minPrepTimeMinutes} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, minPrepTimeMinutes: Number(event.target.value) } }))} />
                  <Input label="Maximum prep minutes" type="number" min="1" value={delivery.instant.maxPrepTimeMinutes} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, maxPrepTimeMinutes: Number(event.target.value) } }))} />
                  <Input id="operating-until" error={issueMessage('operating-until')} label="Operating until" type="time" value={delivery.instant.operatingUntil} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, operatingUntil: event.target.value } }))} />
                  <Input id="order-cutoff" error={issueMessage('order-cutoff')} label="Order cutoff" type="time" value={delivery.instant.orderCutoffTime} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, orderCutoffTime: event.target.value } }))} />
                </div>
              ) : null}
              {/* Inputs with their own id carry their message; these range and day-group issues
                  describe the container above, which takes focus for them. */}
              {issues.filter((item) => (SCHEDULE_GROUP_FIELDS as readonly string[]).includes(item.field)).map((item) => <p key={`${item.field}-${item.message}`} id={`${item.field}-error`} className="mt-2 text-xs text-destructive">{item.message}</p>)}
            </div>
          </StepSection>

          <StepSection id="shipping-charge-section" title="Delivery charge">
            <div className="grid gap-3 @min-[32rem]:grid-cols-2">
              <RadioCard name="shipping" value="FLAT" checked={delivery.shippingStrategy === 'FLAT'} title="Flat charge" description="Use one delivery charge for every order." onChange={() => updateDelivery((current) => ({ ...current, shippingStrategy: 'FLAT' }))} />
              <RadioCard name="shipping" value="ORDER_AMOUNT_THRESHOLD" checked={delivery.shippingStrategy === 'ORDER_AMOUNT_THRESHOLD'} title="Free over a threshold" description="Charge delivery below a chosen order amount." onChange={() => updateDelivery((current) => ({ ...current, shippingStrategy: 'ORDER_AMOUNT_THRESHOLD' }))} />
            </div>
            <div className="mt-3 grid gap-3 @min-[32rem]:grid-cols-2">
              <Input id="shipping-charge" label="Delivery charge (₹)" type="number" min="0" step="0.01" value={delivery.shipping.charge} error={issues.find((item) => item.field === 'shipping-charge')?.message} onChange={(event) => updateDelivery((current) => ({ ...current, shipping: { ...current.shipping, charge: Number(event.target.value) } }))} />
              {delivery.shippingStrategy === 'ORDER_AMOUNT_THRESHOLD' ? <Input id="free-threshold" label="Free delivery above (₹)" type="number" min="0" step="0.01" value={delivery.shipping.freeDeliveryThreshold} error={issues.find((item) => item.field === 'free-threshold')?.message} onChange={(event) => updateDelivery((current) => ({ ...current, shipping: { ...current.shipping, freeDeliveryThreshold: Number(event.target.value) } }))} /> : null}
            </div>
          </StepSection>

          <StepSection
            id="delivery-slots"
            title="Delivery slots"
            description="Optional delivery windows."
            aside={<Button variant="outline" size="sm" onClick={addSlot}><PlusIcon /> Add slot</Button>}
          >
            <div className="space-y-2">
              {delivery.slots.map((slot) => (
                <div key={slot.id} id={`slot-${slot.id}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-lg bg-[var(--ob-canvas)] p-3">
                  <Input label="Starts" type="time" value={slot.startTime} onChange={(event) => updateDelivery((current) => ({ ...current, slots: current.slots.map((item) => item.id === slot.id ? { ...item, startTime: event.target.value } : item) }))} />
                  <Input label="Ends" type="time" value={slot.endTime} onChange={(event) => updateDelivery((current) => ({ ...current, slots: current.slots.map((item) => item.id === slot.id ? { ...item, endTime: event.target.value } : item) }))} />
                  <Button variant="ghost" size="sm" aria-label="Remove delivery slot" onClick={() => updateDelivery((current) => ({ ...current, slots: current.slots.filter((item) => item.id !== slot.id) }))}><Trash2Icon /></Button>
                  <div className="col-span-full"><FieldError issues={issues} field={`slot-${slot.id}`} /></div>
                </div>
              ))}
              {!delivery.slots.length ? <p className="text-sm text-[var(--ob-ink-soft)]">No restricted time slots. Customers can use the configured scheduling strategy.</p> : null}
            </div>
          </StepSection>
        </>
      ) : (
        <div className="mt-6">
          <Hint>Home-delivery scheduling and shipping charges are hidden because this store currently offers pickup only.</Hint>
        </div>
      )}

      <StepSection id="consent" title="Order consent" description="Optional customer message.">
        <div id="consent" aria-describedby={describedBy('consent')} className="grid gap-3 @min-[32rem]:grid-cols-2">
          <Input label="Consent title (optional)" value={delivery.consentTitle} onChange={(event) => updateDelivery((current) => ({ ...current, consentTitle: event.target.value }))} />
          <Input label="Consent message (optional)" value={delivery.consentText} onChange={(event) => updateDelivery((current) => ({ ...current, consentText: event.target.value }))} />
          <div className="@min-[32rem]:col-span-2"><FieldError issues={issues} field="consent" /></div>
        </div>
      </StepSection>
    </div>
  )
}

export function PaymentStep({ issues }: { issues: ValidationIssue[] }) {
  const draft = useOnboardingStore((state) => state.draft)
  const runtime = useOnboardingStore((state) => state.runtime)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const updateRuntime = useOnboardingStore((state) => state.updateRuntime)

  const toggle = (type: PaymentType, enabled: boolean) => updateDraft(
    (current) => {
      let payments = current.payments.map((payment) => payment.type === type
        ? { ...payment, enabled, isDefault: enabled ? payment.isDefault : false }
        : payment)
      if (payments.some((payment) => payment.enabled) && !payments.some((payment) => payment.enabled && payment.isDefault)) {
        const fallbackType = payments.find((payment) => payment.enabled)?.type
        payments = payments.map((payment) => ({
          ...payment,
          isDefault: payment.type === fallbackType,
        }))
      }
      return {
        ...current,
        payments,
      }
    },
    8,
  )

  const setDefault = (type: PaymentType) => updateDraft(
    (current) => ({
      ...current,
      payments: current.payments.map((payment) => ({ ...payment, isDefault: payment.enabled && payment.type === type })),
    }),
    8,
  )

  const paymentOptionsError = issues.some((item) => item.field === 'payment-options')
  const paymentDefaultError = issues.some((item) => item.field === 'payment-default')

  const updatePaymentDetails = (patch: Partial<PaymentDetailsRuntime>) => updateRuntime({
    paymentDetails: { ...runtime.paymentDetails, ...patch },
  }, 8)

  return (
    <div className="space-y-5">
      <div id="payment-options" aria-describedby={paymentOptionsError ? 'payment-options-error' : undefined} className="space-y-3">
        {draft.payments.map((payment) => {
          const label = PAYMENT_LABELS[payment.type]
          return (
            <section key={payment.type} className={cn(
              'rounded-xl border p-4 transition-[border-color,background-color]',
              payment.enabled
                ? 'border-[var(--ob-brand)] bg-[var(--ob-brand-soft)]'
                : 'border-[var(--ob-line)] bg-[var(--ob-sheet)]',
            )}>
              <div className="flex items-start justify-between gap-4">
                <label className="flex min-w-0 cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={payment.enabled} onChange={(event) => toggle(payment.type, event.target.checked)} className="mt-2.5" />
                  <PaymentMethodIcon type={payment.type} />
                  <span className="pt-0.5">
                    <strong className="block text-sm text-[var(--ob-ink)]">{label.title}</strong>
                    <span className="mt-1 block text-xs leading-5 text-[var(--ob-ink-soft)]">{label.description}</span>
                  </span>
                </label>
                <label className={cn('flex shrink-0 items-center gap-2 text-xs font-medium', !payment.enabled && 'opacity-50')}>
                  <input type="radio" name="default-payment" aria-describedby={paymentDefaultError ? 'payment-default-error' : undefined} checked={payment.isDefault} disabled={!payment.enabled} onChange={() => setDefault(payment.type)} /> Default
                </label>
              </div>

              {payment.enabled && payment.type === 'PRE_PAID' ? (
                <div className="mt-4 grid gap-3 border-t border-[var(--ob-line)] pt-4 @min-[32rem]:grid-cols-2">
                  <Input
                    id="upi-id"
                    label="UPI ID"
                    value={runtime.paymentDetails.upiId}
                    error={issues.find((item) => item.field === 'upi-id')?.message}
                    onChange={(event) => updatePaymentDetails({ upiId: event.target.value })}
                    placeholder="name@bank"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <Input
                    id="upi-account-holder-name"
                    label="Account holder name"
                    value={runtime.paymentDetails.upiAccountHolderName}
                    error={issues.find((item) => item.field === 'upi-account-holder-name')?.message}
                    onChange={(event) => updatePaymentDetails({ upiAccountHolderName: event.target.value })}
                    autoComplete="off"
                  />
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
      <FieldError issues={issues} field="payment-options" />
      {/* The default radios sit one per method, so this container is the focus target. */}
      <div id="payment-default" aria-describedby={paymentDefaultError ? 'payment-default-error' : undefined}>
        <FieldError issues={issues} field="payment-default" />
      </div>
      {/* `payments` is the step-wide issue field (a failed save); it has no input of its own. */}
      {issues.some((item) => item.field === 'payments') ? (
        <div id="payments" aria-describedby="payments-error"><FieldError issues={issues} field="payments" /></div>
      ) : null}
      <p className="text-xs leading-5 text-[var(--ob-ink-soft)]">Payment details stay only in this tab during prototype mode.</p>
    </div>
  )
}
