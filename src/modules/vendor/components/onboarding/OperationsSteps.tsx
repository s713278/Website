import { useEffect, useMemo, useState } from 'react'
import {
  BanknoteIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  LandmarkIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
  WalletCardsIcon,
} from 'lucide-react'
import productFallbackImage from '@/assets/onboarding/product-fallback.svg'
import { cn } from '@/lib/utils'
import { Button, EmptyState, Input } from '@/shared/components/ui'
import { localSkuId } from '../../lib/onboarding-sku-id'
import { validateDraftSku } from '../../lib/onboarding-validation'
import { useSingleOpen } from '../../hooks/use-single-open'
import { useOnboardingStore } from '../../store/onboarding-store'
import type {
  DeliveryDraft,
  DraftSku,
  MeasurementType,
  PaymentDetailsRuntime,
  PaymentType,
  SchedulingStrategy,
  ValidationIssue,
  Weekday,
} from '../../types/onboarding'
import {
  defaultUnitForMeasurement,
  measurementFromProduct,
  measurementLabel,
  unitOptionsForMeasurement,
  unitsForMeasurement,
  type MeasurementCatalog,
} from '../../lib/onboarding-measurement'
import { AccordionPanel, FieldError, FieldLabel, Hint, type RequestConfirmation, StepSection } from './StepPrimitives'

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

function SkuProductThumb({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const usingFallback = !src || failedSrc === src

  return (
    <img
      src={usingFallback ? productFallbackImage : src}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-12 shrink-0 rounded-xl object-cover"
      onError={() => {
        if (!usingFallback && src) setFailedSrc(src)
      }}
    />
  )
}

function makeSku(
  product: { id: number; name: string; measurementId: number | null; measurementName: string | null },
  skus: DraftSku[],
  catalog: MeasurementCatalog,
): DraftSku {
  const isFirstSku = !skus.some((sku) => sku.productId === product.id)
  const measurementType = measurementFromProduct(product.measurementId, product.measurementName, catalog)
  return {
    id: localSkuId(product.id, skus),
    productId: product.id,
    name: isFirstSku ? product.name : '',
    description: '',
    skuType: 'ITEM',
    measurementType,
    unit: defaultUnitForMeasurement(measurementType, catalog),
    quantity: 1,
    listPrice: null,
    salePrice: null,
    active: true,
    homeDelivery: true,
    storePickup: true,
  }
}

export function SkuStep({ issues, confirm }: { issues: ValidationIssue[]; confirm: RequestConfirmation }) {
  const draft = useOnboardingStore((state) => state.draft)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const measurementCatalog = useOnboardingStore((state) => state.measurementCatalog)
  const productIds = useMemo(() => draft.products.map((product) => product.id), [draft.products])
  const { openId, setOpenId, onToggle } = useSingleOpen(productIds)

  // Deliberately no `invalidateFrom`. These are empty scaffolding rows for products that
  // have none yet, not an edit the vendor made — and invalidating from Step 6 would drop
  // `furthestVisitedStep` to 6 and filter `completedSteps`. A vendor who resumed at Step 9
  // with one unpriced product left over (the exact case `furthestSavedStep` exists to
  // protect) would lose Steps 7-10 just by opening Step 6 to look at it.
  useEffect(() => {
    if (!draft.products.some((product) => !draft.skus.some((sku) => sku.productId === product.id))) return
    updateDraft((current) => {
      const skus = [...current.skus]
      for (const product of current.products) {
        if (!skus.some((sku) => sku.productId === product.id)) skus.push(makeSku(product, skus, measurementCatalog))
      }
      return { ...current, skus }
    })
  }, [draft.products, draft.skus, updateDraft, measurementCatalog])

  // A problem inside a closed product would otherwise be reported with nothing on
  // screen to fix. Only one panel can be open, so open the first product that has one.
  useEffect(() => {
    if (!issues.length) return
    const faulty = draft.products.find(
      (product) =>
        issues.some((item) => item.field === `product-${product.id}`) ||
        draft.skus.some(
          (sku) => sku.productId === product.id && issues.some((item) => item.field.startsWith(`sku-${sku.id}`)),
        ),
    )
    if (faulty) setOpenId(faulty.id)
  }, [draft.products, draft.skus, issues, setOpenId])

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

    confirm({
      title: 'Remove this size?',
      description: 'Its measurement, fulfilment choices, and prices will be removed.',
      confirmLabel: 'Remove size',
      tone: 'danger',
      onConfirm: () => updateDraft(
        (current) => {
          const remainingForProduct = current.skus.filter((item) => item.productId === sku.productId)
          if (remainingForProduct.length <= 1) return current
          return { ...current, skus: current.skus.filter((item) => item.id !== sku.id) }
        },
        6,
      ),
    })
  }

  if (!draft.products.length) {
    return <EmptyState title="Choose products first" description="Return to Step 5 to build your starting catalog." />
  }

  return (
    <div className="space-y-5">
      <Hint className="mb-5">
        Give each product at least one size and its price. Add another size only when a different pack sells for a different price.
      </Hint>
      {draft.products.map((product) => {
        const productSkus = draft.skus.filter((sku) => sku.productId === product.id)
        const productSkuIssues = productSkus.flatMap((sku) => validateDraftSku(sku, productSkus))
        const hasValidActiveSku = productSkus.some(
          (sku) => sku.active && validateDraftSku(sku, productSkus).length === 0,
        )
        const ready = hasValidActiveSku && productSkuIssues.length === 0
        return (
          <AccordionPanel
            key={product.id}
            id={`product-${product.id}`}
            open={openId === product.id}
            onToggle={onToggle(product.id)}
            summary={
              <>
                <SkuProductThumb src={product.imageUrl} />
                <div className="min-w-0 flex-1">
                  <h3 id={`sku-product-${product.id}`} className="truncate font-display font-semibold text-[var(--ob-ink)]">{product.name}</h3>
                  <p className="mt-0.5 text-xs text-[var(--ob-ink-soft)]">
                    {productSkus.length} {productSkus.length === 1 ? 'size' : 'sizes'} added
                  </p>
                </div>
                <span className={cn(
                  'hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex',
                  ready
                    ? 'bg-[var(--ob-brand-soft)] text-[var(--ob-brand)]'
                    : 'bg-amber-100/80 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200',
                )}>
                  {ready ? <CheckCircle2Icon className="size-3.5" /> : <CircleAlertIcon className="size-3.5" />}
                  {ready ? 'Ready' : 'Needs pricing'}
                </span>
              </>
            }
          >
            <div>
              <div className="mb-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateDraft((current) => ({ ...current, skus: [...current.skus, makeSku(product, current.skus, measurementCatalog)] }), 6)}
                >
                  <PlusIcon /> Add another size
                </Button>
              </div>
              <FieldError issues={issues} field={`product-${product.id}`} />
              <div className="space-y-3">
                {productSkus.map((sku) => (
                  <div key={sku.id} className="rounded-xl bg-background p-4 shadow-sm ring-1 ring-[var(--ob-line)] ring-inset" aria-label={`${sku.name || product.name} size`}>
                    {productSkus.length > 1 ? (
                      <div className="mb-3 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label={`Remove ${sku.name || 'size'}`} onClick={() => removeSku(sku)}>
                          <Trash2Icon /> Remove size
                        </Button>
                      </div>
                    ) : null}
                    <div className="grid gap-3 @min-[32rem]:grid-cols-2 @min-[46rem]:grid-cols-3">
                      <Input
                        id={`sku-${sku.id}-name`}
                        label="Size name"
                        value={sku.name}
                        error={issues.find((item) => item.field === `sku-${sku.id}-name`)?.message}
                        onChange={(event) => updateSku(sku.id, { name: event.target.value })}
                      />
                      <div>
                        <FieldLabel htmlFor={`sku-${sku.id}-measurement`}>Measurement</FieldLabel>
                        <select
                          id={`sku-${sku.id}-measurement`}
                          value={sku.measurementType}
                          onChange={(event) => {
                            const measurementType = event.target.value as MeasurementType
                            updateSku(sku.id, { measurementType, unit: defaultUnitForMeasurement(measurementType, measurementCatalog) })
                          }}
                          className="h-11 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] px-3 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
                        >
                          {measurementCatalog.map((entry) => (
                            <option key={entry.id} value={entry.type}>{measurementLabel(entry.type)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel htmlFor={`sku-${sku.id}-unit`}>Unit</FieldLabel>
                        <select
                          id={`sku-${sku.id}-unit`}
                          value={sku.unit}
                          aria-invalid={issues.some((item) => item.field === `sku-${sku.id}-unit`) || undefined}
                          aria-describedby={issues.some((item) => item.field === `sku-${sku.id}-unit`) ? `sku-${sku.id}-unit-error` : undefined}
                          onChange={(event) => updateSku(sku.id, { unit: event.target.value })}
                          className="h-11 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] px-3 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
                        >
                          {unitsForMeasurement(sku.measurementType, measurementCatalog).map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                        <FieldError issues={issues} field={`sku-${sku.id}-unit`} />
                      </div>
                      <Input
                        id={`sku-${sku.id}-quantity`}
                        label="Quantity / value"
                        type="number"
                        min="1"
                        step="1"
                        value={sku.quantity ?? ''}
                        error={issues.find((item) => item.field === `sku-${sku.id}-quantity`)?.message}
                        onChange={(event) => updateSku(sku.id, { quantity: parseDraftNumber(event.target.value) })}
                        onWheel={(event) => event.currentTarget.blur()}
                        list={`sku-${sku.id}-quantity-options`}
                      />
                      <datalist id={`sku-${sku.id}-quantity-options`}>
                        {unitOptionsForMeasurement(sku.measurementType, measurementCatalog).map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <Input
                        id={`sku-${sku.id}-list-price`}
                        label="List price (₹)"
                        type="number"
                        min="1"
                        step="1"
                        value={sku.listPrice ?? ''}
                        error={issues.find((item) => item.field === `sku-${sku.id}-list-price`)?.message}
                        onChange={(event) => updateSku(sku.id, { listPrice: parseDraftNumber(event.target.value) })}
                        onWheel={(event) => event.currentTarget.blur()}
                      />
                      <Input
                        id={`sku-${sku.id}-sale-price`}
                        label="Sale price (₹)"
                        type="number"
                        min="1"
                        step="1"
                        value={sku.salePrice ?? ''}
                        error={issues.find((item) => item.field === `sku-${sku.id}-sale-price`)?.message}
                        onChange={(event) => updateSku(sku.id, { salePrice: parseDraftNumber(event.target.value) })}
                        onWheel={(event) => event.currentTarget.blur()}
                      />
                      <div className="@min-[32rem]:col-span-2 @min-[46rem]:col-span-3">
                        <Input
                          id={`sku-${sku.id}-description`}
                          label="Description (optional)"
                          value={sku.description}
                          maxLength={240}
                          error={issues.find((item) => item.field === `sku-${sku.id}-description`)?.message}
                          onChange={(event) => updateSku(sku.id, { description: event.target.value })}
                        />
                      </div>
                    </div>
                    <div id={`sku-${sku.id}-fulfillment`} className="mt-3 flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={sku.active} onChange={(event) => updateSku(sku.id, { active: event.target.checked })} /> Active</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={sku.homeDelivery} onChange={(event) => updateSku(sku.id, { homeDelivery: event.target.checked })} /> Home delivery</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={sku.storePickup} onChange={(event) => updateSku(sku.id, { storePickup: event.target.checked })} /> Store pickup</label>
                    </div>
                    <FieldError issues={issues} field={`sku-${sku.id}-fulfillment`} />
                  </div>
                ))}
              </div>
            </div>
          </AccordionPanel>
        )
      })}
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

  const addSlot = () => updateDelivery((current) => ({
    ...current,
    slots: [...current.slots, { id: `draft-slot-${Math.max(0, ...current.slots.map((slot) => Number(slot.id.replace('draft-slot-', '')) || 0)) + 1}`, startTime: '09:00', endTime: '12:00' }],
  }))

  return (
    <div>
      <StepSection id="fulfillment" title="Fulfilment" description="How orders reach your customers.">
        <div className="grid gap-3 @min-[38rem]:grid-cols-3">
          <RadioCard name="fulfillment" value="HOME_DELIVERY" checked={delivery.fulfillmentType === 'HOME_DELIVERY'} title="Home delivery" description="Deliver orders to customers." onChange={() => setFulfillment('HOME_DELIVERY')} />
          <RadioCard name="fulfillment" value="STORE_PICKUP" checked={delivery.fulfillmentType === 'STORE_PICKUP'} title="Store pickup" description="Customers collect from your store." onChange={() => setFulfillment('STORE_PICKUP')} />
          <RadioCard name="fulfillment" value="BOTH" checked={delivery.fulfillmentType === 'BOTH'} title="Both" description="Let customers choose at checkout." onChange={() => setFulfillment('BOTH')} />
        </div>
      </StepSection>

      <StepSection id="order-acceptance" title="Order acceptance" description="Whether a new order needs your say-so before it moves.">
        <div className="grid gap-3 @min-[32rem]:grid-cols-2">
          <RadioCard name="acceptance" value="AUTO_ACCEPT" checked={delivery.orderAcceptancePolicy === 'AUTO_ACCEPT'} title="Automatic" description="Orders move ahead without manual review." onChange={() => updateDelivery((current) => ({ ...current, orderAcceptancePolicy: 'AUTO_ACCEPT' }))} />
          <RadioCard name="acceptance" value="MANUAL_APPROVAL" checked={delivery.orderAcceptancePolicy === 'MANUAL_APPROVAL'} title="Manual approval" description="Review each order before accepting it." onChange={() => updateDelivery((current) => ({ ...current, orderAcceptancePolicy: 'MANUAL_APPROVAL' }))} />
        </div>
      </StepSection>

      {hasHomeDelivery ? (
        <>
          <StepSection id="delivery-schedule" title="Delivery schedule" description="When you deliver, and how far ahead customers can order.">
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
                <div id="fixed-window" className="grid gap-3 @min-[32rem]:grid-cols-2">
                  <Input label="Minimum delivery days" type="number" min="0" value={delivery.fixedWindow.minDeliveryDays} onChange={(event) => updateDelivery((current) => ({ ...current, fixedWindow: { ...current.fixedWindow, minDeliveryDays: Number(event.target.value) } }))} />
                  <Input label="Maximum delivery days" type="number" min="1" value={delivery.fixedWindow.maxDeliveryDays} onChange={(event) => updateDelivery((current) => ({ ...current, fixedWindow: { ...current.fixedWindow, maxDeliveryDays: Number(event.target.value) } }))} />
                </div>
              ) : null}
              {delivery.schedulingStrategy === 'CUSTOMER_SELECT_DATE' ? (
                <div id="customer-date-range" className="grid gap-3 @min-[38rem]:grid-cols-3">
                  <Input label="Minimum advance days" type="number" min="0" value={delivery.customerSelectDate.minAdvanceBookingDays} onChange={(event) => updateDelivery((current) => ({ ...current, customerSelectDate: { ...current.customerSelectDate, minAdvanceBookingDays: Number(event.target.value) } }))} />
                  <Input label="Maximum advance days" type="number" min="1" value={delivery.customerSelectDate.maxAdvanceBookingDays} onChange={(event) => updateDelivery((current) => ({ ...current, customerSelectDate: { ...current.customerSelectDate, maxAdvanceBookingDays: Number(event.target.value) } }))} />
                  <Input id="customer-cutoff" label="Daily cutoff" type="time" value={delivery.customerSelectDate.cutoffTime} onChange={(event) => updateDelivery((current) => ({ ...current, customerSelectDate: { ...current.customerSelectDate, cutoffTime: event.target.value } }))} />
                </div>
              ) : null}
              {delivery.schedulingStrategy === 'PREDEFINED_DAYS' ? (
                <div>
                  <div id="predefined-days" className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                      const selected = delivery.predefinedDays.days.includes(day.value)
                      return <button key={day.value} type="button" aria-pressed={selected} onClick={() => updateDelivery((current) => ({ ...current, predefinedDays: { ...current.predefinedDays, days: selected ? current.predefinedDays.days.filter((value) => value !== day.value) : [...current.predefinedDays.days, day.value] } }))} className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>{day.label}</button>
                    })}
                  </div>
                  <div className="mt-3 max-w-xs"><Input id="max-orders" label="Maximum orders per day" type="number" min="1" value={delivery.predefinedDays.maxOrdersPerDay} onChange={(event) => updateDelivery((current) => ({ ...current, predefinedDays: { ...current.predefinedDays, maxOrdersPerDay: Number(event.target.value) } }))} /></div>
                </div>
              ) : null}
              {delivery.schedulingStrategy === 'INSTANT' ? (
                <div id="prep-range" className="grid gap-3 @min-[32rem]:grid-cols-2">
                  <Input label="Minimum prep minutes" type="number" min="1" value={delivery.instant.minPrepTimeMinutes} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, minPrepTimeMinutes: Number(event.target.value) } }))} />
                  <Input label="Maximum prep minutes" type="number" min="1" value={delivery.instant.maxPrepTimeMinutes} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, maxPrepTimeMinutes: Number(event.target.value) } }))} />
                  <Input id="operating-until" label="Operating until" type="time" value={delivery.instant.operatingUntil} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, operatingUntil: event.target.value } }))} />
                  <Input id="order-cutoff" label="Order cutoff" type="time" value={delivery.instant.orderCutoffTime} onChange={(event) => updateDelivery((current) => ({ ...current, instant: { ...current.instant, orderCutoffTime: event.target.value } }))} />
                </div>
              ) : null}
              {issues.filter((item) => ['fixed-window', 'customer-date-range', 'customer-cutoff', 'predefined-days', 'max-orders', 'prep-range', 'operating-until', 'order-cutoff'].includes(item.field)).map((item) => <p key={`${item.field}-${item.message}`} className="mt-2 text-xs text-destructive">{item.message}</p>)}
            </div>
          </StepSection>

          <StepSection id="shipping-charge-section" title="Delivery charge" description="What a customer pays to have an order brought to them.">
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
            description="Optional. Restrict deliveries to set windows in the day."
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

      <StepSection id="consent" title="Order consent" description="Optional. Shown to a customer before they confirm an order.">
        <div className="grid gap-3 @min-[32rem]:grid-cols-2">
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

  const updatePaymentDetails = (patch: Partial<PaymentDetailsRuntime>) => updateRuntime({
    paymentDetails: { ...runtime.paymentDetails, ...patch },
  }, 8)

  return (
    <div className="space-y-5">
      <Hint icon={<WalletCardsIcon className="size-4 text-[var(--ob-brand)]" />}>
        Choose every payment method you accept and mark one as the default.
      </Hint>
      <div id="payment-options" className="space-y-3">
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
                  <input type="radio" name="default-payment" checked={payment.isDefault} disabled={!payment.enabled} onChange={() => setDefault(payment.type)} /> Default
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

              {payment.enabled && payment.type === 'ONLINE' ? (
                <div className="mt-4 grid gap-3 border-t border-[var(--ob-line)] pt-4 @min-[32rem]:grid-cols-2">
                  <Input
                    id="bank-account-holder-name"
                    label="Account holder name"
                    value={runtime.paymentDetails.bankAccountHolderName}
                    error={issues.find((item) => item.field === 'bank-account-holder-name')?.message}
                    onChange={(event) => updatePaymentDetails({ bankAccountHolderName: event.target.value })}
                    autoComplete="off"
                  />
                  <Input
                    id="bank-account-number"
                    label="Account number"
                    value={runtime.paymentDetails.bankAccountNumber}
                    error={issues.find((item) => item.field === 'bank-account-number')?.message}
                    onChange={(event) => updatePaymentDetails({ bankAccountNumber: event.target.value })}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <Input
                    id="bank-ifsc-code"
                    label="IFSC code"
                    value={runtime.paymentDetails.bankIfscCode}
                    error={issues.find((item) => item.field === 'bank-ifsc-code')?.message}
                    onChange={(event) => updatePaymentDetails({ bankIfscCode: event.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Input
                    id="bank-name"
                    label="Bank name"
                    value={runtime.paymentDetails.bankName}
                    error={issues.find((item) => item.field === 'bank-name')?.message}
                    onChange={(event) => updatePaymentDetails({ bankName: event.target.value })}
                    autoComplete="off"
                  />
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
      <FieldError issues={issues} field="payment-options" />
      <FieldError issues={issues} field="payment-default" />
      <p className="text-xs leading-5 text-[var(--ob-ink-soft)]">Payment details stay only in this tab during prototype mode.</p>
    </div>
  )
}
