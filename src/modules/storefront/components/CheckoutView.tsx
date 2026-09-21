import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  MapPin,
  Package,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
} from 'lucide-react'
import {
  formatCheckoutDateChip,
  getErrorMessage,
  ordersService,
  type StorefrontCheckoutOptions,
  type StorefrontCheckoutPayment,
} from '@/shared/api'
import { DeliveryAddressPicker } from '@/shared/components/DeliveryAddressPicker'
import { useDeliveryLocation } from '@/shared/hooks/useDeliveryLocation'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { StorefrontMobileActionBar } from '@/modules/storefront/components/StorefrontMobileActionBar'
import { lineAmount, priceDetailsFromSummary } from '@/modules/storefront/lib/cart-utils'
import {
  storeCartPath,
  storeOrderSuccessPath,
  storePath,
  storeSearchPath,
} from '@/modules/storefront/lib/store-paths'
import { buildWhatsAppOrderMessage } from '@/modules/storefront/lib/whatsapp-order'
import { summaryFromLines, useCartStore } from '@/modules/storefront/store/cart-store'
import type { CartLine, Store } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
import { useDeliveryAddressStore } from '@/shared/store/delivery-address-store'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

type CheckoutViewProps = {
  store: Store
  lines: CartLine[]
  cartCount: number
  checkoutOptions?: StorefrontCheckoutOptions | null
  /** True when GET checkout_options failed (e.g. vendor delivery config missing). */
  checkoutUnavailable?: boolean
  onBack: () => void
}

function deliveryMethodLabel(method: string) {
  if (method === 'STORE_PICKUP') return 'Store pickup'
  return 'Home delivery'
}

/** Customer-facing copy for API `scheduling_strategy`. */
function schedulingStrategyLabel(strategy: string | null | undefined): {
  title: string
  hint: string
} | null {
  if (!strategy) return null
  switch (strategy) {
    case 'FIXED_WINDOW':
      return {
        title: 'Fixed window',
        hint: 'Choose a delivery date from the window this store offers',
      }
    case 'CUSTOMER_SELECT_DATE':
      return {
        title: 'Choose your date',
        hint: 'Pick any available delivery date below',
      }
    case 'PREDEFINED_DAYS':
      return {
        title: 'Scheduled days',
        hint: 'Delivery on the store’s scheduled days',
      }
    case 'INSTANT':
      return {
        title: 'Instant delivery',
        hint: 'Your order goes out as soon as it’s confirmed',
      }
    default:
      return {
        title: strategy.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
        hint: 'Delivery schedule from this store',
      }
  }
}

function paymentIcon(type: StorefrontCheckoutPayment['type'] | undefined) {
  return type === 'CASH_ON_DELIVERY' ? Banknote : CreditCard
}

export function CheckoutView({
  store,
  lines,
  cartCount,
  checkoutOptions = null,
  checkoutUnavailable = false,
  onBack,
}: CheckoutViewProps) {
  const navigate = useNavigate()
  const storedSummary = useCartStore((s) => s.summaries?.[store.id])
  const summary = useMemo(
    () => storedSummary ?? summaryFromLines(lines),
    [storedSummary, lines],
  )
  // Totals come from cart API summary — do not recompute delivery from checkout_options.
  const totals = priceDetailsFromSummary(summary)

  const clear = useCartStore((s) => s.clear)
  const user = useAuthStore((s) => s.user)
  const phone = user?.phone ?? ''
  const { selected, pickerProps, openChange, openMap } = useDeliveryLocation(store.id)

  const deliverySlots = checkoutOptions?.deliverySlots ?? []
  const paymentOptions = checkoutOptions?.paymentOptions ?? []
  const deliveryMethods = checkoutOptions?.deliveryMethods ?? []
  const scheduling = schedulingStrategyLabel(checkoutOptions?.schedulingStrategy)
  const useDateChips = deliverySlots.some((slot) => Boolean(slot.date))
  const consentTitle = checkoutOptions?.consentTitle
  const consentText = checkoutOptions?.consentText
  const requiresConsent = Boolean(consentTitle || consentText)

  const defaultPaymentId =
    paymentOptions.find((option) => option.isDefault)?.id ?? paymentOptions[0]?.id ?? ''

  const [deliverySlot, setDeliverySlot] = useState(deliverySlots[0]?.id ?? '')
  const [payment, setPayment] = useState(defaultPaymentId)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!deliverySlots.some((slot) => slot.id === deliverySlot) && deliverySlots[0]) {
      setDeliverySlot(deliverySlots[0].id)
    }
  }, [deliverySlots, deliverySlot])

  useEffect(() => {
    if (!paymentOptions.some((option) => option.id === payment) && defaultPaymentId) {
      setPayment(defaultPaymentId)
    }
  }, [paymentOptions, payment, defaultPaymentId])

  useEffect(() => {
    setConsentAccepted(false)
  }, [consentTitle, consentText])

  const selectedSlot = deliverySlots.find((slot) => slot.id === deliverySlot)
  const slotLabel = selectedSlot?.label ?? 'Delivery'
  const deliveryMethod = deliveryMethods[0] ?? 'HOME_DELIVERY'
  const deliveryDate = selectedSlot?.date ?? selectedSlot?.id ?? ''

  const selectedPayment = paymentOptions.find((option) => option.id === payment)
  const selectedPaymentLabel = selectedPayment?.label ?? 'Payment'

  const canPlace =
    Boolean(selected) &&
    Boolean(deliverySlot || deliverySlots.length === 0) &&
    Boolean(payment || paymentOptions.length === 0) &&
    (!requiresConsent || consentAccepted) &&
    !placing

  async function placeOrderOnWhatsApp() {
    if (!selected) {
      setError('Add a delivery location to continue.')
      openMap()
      return
    }
    if (requiresConsent && !consentAccepted) {
      setError('Please accept the store terms to continue.')
      return
    }

    setPlacing(true)
    setError('')
    try {
      const order = await ordersService.placeOrder({
        storeId: store.id,
        storeName: store.name,
        address: selected.location,
        phone,
        note: `Slot: ${slotLabel} · Payment: ${selectedPaymentLabel}`,
        lines,
        deliveryFee: totals.delivery,
        total: totals.total,
        userId: user?.id,
        userName: user?.name,
        addressId: selected.backendAddressId ?? selected.id,
        lat: selected.lat,
        lng: selected.lng,
        city: selected.city,
        country: selected.country,
        zipCode: selected.zipCode,
        deliveryMethod,
        deliveryDate,
        orderTimingType: checkoutOptions?.schedulingStrategy,
        paymentTypeId: selectedPayment?.id ?? payment,
        pickupSlot: selectedSlot?.label,
      })

      if (order.addressId) {
        useDeliveryAddressStore.getState().updateAddress(selected.id, {
          location: selected.location,
          lat: selected.lat,
          lng: selected.lng,
          city: selected.city,
          country: selected.country,
          zipCode: selected.zipCode,
          backendAddressId: order.addressId,
        })
      }

      const message = buildWhatsAppOrderMessage({
        orderId: order.id,
        storeName: store.name,
        location: selected.location,
        phone,
        lines,
        subtotal: totals.subtotal,
        deliveryFee: totals.delivery,
        packagingFee: totals.packaging,
        total: totals.total,
        deliverySlot: slotLabel,
        paymentLabel: selectedPaymentLabel,
      })

      clear()

      navigate(storeOrderSuccessPath(store.id, order.id), {
        replace: true,
        state: {
          storeName: store.name,
          deliverySlot: slotLabel,
          whatsappMessage: message,
        },
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not place order'))
    } finally {
      setPlacing(false)
    }
  }

  const placeOrderLabel = placing
    ? 'Placing order…'
    : `Place order · ${formatCurrency(totals.total)}`

  const itemLabel = `${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'} in your cart`

  return (
    <>
      <StorefrontHeader
        storeName={store.name}
        logoUrl={store.theme?.logoImage}
        cartCount={cartCount}
        cartHref={storeCartPath(store.id)}
        searchOpen={false}
        onToggleSearch={() => navigate(storeSearchPath(store.id))}
        pageTitle="Checkout"
        onBack={onBack}
      />

      {checkoutUnavailable ? (
        <main className="store-shell-inner flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mx-auto w-full max-w-md">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100">
              <Truck className="size-7" strokeWidth={1.75} aria-hidden />
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-slate-900">
              Delivery isn't available right now
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              {store.name} isn't accepting orders for delivery at the moment.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-xl bg-[var(--store-theme,var(--md-green-800))] px-6 text-white hover:opacity-90"
                onClick={onBack}
              >
                Back to cart
              </Button>
              <Link
                to={storePath(store.id)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <StoreIcon className="size-4" aria-hidden />
                Browse store
              </Link>
            </div>
          </div>
        </main>
      ) : (
        <>
          <main
            className={cn(
              'store-shell-inner flex-1 py-5 sm:py-6',
              'pb-36 sm:pb-40 lg:pb-10',
            )}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
              <section className="space-y-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.04)] sm:p-7">
                <CheckoutSection
                  icon={MapPin}
                  title="Deliver to"
                  hint="Where should we send this order?"
                >
                  {selected ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-[var(--store-theme-soft,rgba(16,185,129,0.12))] px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {selected.location}
                        </p>
                        {deliveryMethods.length > 0 ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {deliveryMethods.map(deliveryMethodLabel).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={openChange}
                        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Change
                        <ChevronRight className="size-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
                      <p className="text-sm text-slate-600">Add a delivery location to continue.</p>
                      <Button
                        type="button"
                        className="mt-4 rounded-xl bg-[var(--store-theme,var(--md-green-800))] px-6 text-white hover:opacity-90"
                        onClick={() => openMap()}
                      >
                        Add location
                      </Button>
                    </div>
                  )}
                </CheckoutSection>

                {deliverySlots.length > 0 ? (
                  <CheckoutSection
                    title={useDateChips ? 'Delivery date' : 'Delivery window'}
                    hint={
                      scheduling?.hint ??
                      (useDateChips
                        ? 'Pick a date from the options below'
                        : 'Choose a convenient delivery time')
                    }
                    icon={CalendarDays}
                  >
                    {useDateChips ? (
                      <div className="grid grid-cols-3 gap-2.5">
                        {deliverySlots.map((slot) => {
                          const chip = slot.date
                            ? formatCheckoutDateChip(slot.date)
                            : { weekday: slot.label, day: '' }
                          const checked = deliverySlot === slot.id
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setDeliverySlot(slot.id)}
                              className={cn(
                                'flex w-full min-w-0 items-center justify-between gap-1.5 rounded-2xl border px-2.5 py-3 text-left transition sm:gap-2 sm:px-3.5',
                                checked
                                  ? 'border-[var(--store-theme,var(--md-green-500))] bg-[var(--store-theme-soft,rgba(16,185,129,0.12))]'
                                  : 'border-slate-200 bg-white hover:border-slate-300',
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  {chip.weekday}
                                </span>
                                <span className="mt-0.5 block text-sm font-bold text-slate-900">
                                  {chip.day || slot.label}
                                </span>
                              </span>
                              <RadioMark checked={checked} />
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {deliverySlots.map((slot) => (
                          <ChoiceRow
                            key={slot.id}
                            checked={deliverySlot === slot.id}
                            onChange={() => setDeliverySlot(slot.id)}
                            name="delivery-slot"
                            title={slot.label}
                            subtitle={slot.description}
                            recommended={slot.recommended}
                          />
                        ))}
                      </div>
                    )}
                  </CheckoutSection>
                ) : null}

                {paymentOptions.length > 0 ? (
                  <CheckoutSection title="Payment" hint="How would you like to pay?" icon={CreditCard}>
                    <div className="space-y-2.5">
                      {paymentOptions.map((option) => {
                        const Icon = paymentIcon(option.type)
                        return (
                          <ChoiceRow
                            key={option.id}
                            checked={payment === option.id}
                            onChange={() => setPayment(option.id)}
                            name="payment-method"
                            title={option.label}
                            icon={Icon}
                          />
                        )
                      })}
                    </div>
                  </CheckoutSection>
                ) : null}

                {requiresConsent ? (
                  <ConsentRow
                    title={consentTitle ?? 'Terms'}
                    text={consentText ?? ''}
                    checked={consentAccepted}
                    onChange={setConsentAccepted}
                  />
                ) : null}
              </section>

              <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.04)] sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]">
                      <ShoppingBag className="size-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-bold text-slate-900">Order summary</h2>
                      <p className="mt-0.5 text-sm text-slate-500">{itemLabel}</p>
                    </div>
                  </div>

                  <div className="mt-5 divide-y divide-slate-100">
                    {lines.map((line) => {
                      const imageUrl = line.imageUrl
                      return (
                        <div key={line.itemId} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                          <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {imageUrl ? (
                              <img src={imageUrl} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center text-slate-400">
                                <Package className="size-5" aria-hidden />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                              {line.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">Qty {line.qty}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-slate-900">
                            {formatCurrency(lineAmount(line))}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                    <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
                    <SummaryRow
                      label="Delivery"
                      value={totals.delivery > 0 ? formatCurrency(totals.delivery) : 'Free'}
                      emphasize={totals.delivery === 0}
                    />
                    {totals.discount > 0 ? (
                      <SummaryRow
                        label="Discount"
                        value={`−${formatCurrency(totals.discount)}`}
                        emphasize
                      />
                    ) : null}
                    {totals.service > 0 ? (
                      <SummaryRow label="Service charge" value={formatCurrency(totals.service)} />
                    ) : null}
                  </dl>

                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-sm font-semibold text-slate-900">Total</span>
                    <p className="text-2xl font-bold text-[var(--store-theme,var(--md-green-700))]">
                      {formatCurrency(totals.total)}
                    </p>
                  </div>

                  {deliverySlot ? (
                    <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--store-theme-soft,rgba(16,185,129,0.1))] px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
                      <ShieldCheck
                        className="mt-0.5 size-3.5 shrink-0 text-[var(--store-theme,var(--md-green-700))]"
                        aria-hidden
                      />
                      <span>
                        {scheduling ? (
                          <>
                            <span className="font-medium text-slate-700">{scheduling.title}</span>
                            {' · '}
                          </>
                        ) : null}
                        Arriving <span className="font-medium text-slate-700">{slotLabel}</span>
                        {selectedPaymentLabel ? (
                          <>
                            {' · '}
                            {selectedPaymentLabel}
                          </>
                        ) : null}
                      </span>
                    </p>
                  ) : null}
                </div>

                <p
                  className={cn(
                    'text-sm text-[var(--md-danger)]',
                    error ? 'hidden lg:block' : 'hidden',
                  )}
                  aria-live="polite"
                >
                  {error}
                </p>

                <Button
                  type="button"
                  fullWidth
                  size="lg"
                  className="hidden h-12 justify-between rounded-full bg-[var(--store-theme,var(--md-green-700))] px-5 text-base font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 lg:inline-flex"
                  disabled={!canPlace}
                  onClick={() => void placeOrderOnWhatsApp()}
                >
                  <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{placeOrderLabel}</span>
                  <ChevronRight className="size-4 shrink-0" aria-hidden />
                </Button>

                {requiresConsent ? (
                  <p
                    className={cn(
                      'hidden min-h-4 text-center text-xs text-slate-500 lg:block',
                      consentAccepted ? 'invisible' : 'visible',
                    )}
                  >
                    Accept the store terms to place your order
                  </p>
                ) : null}

                <Link
                  to={storeCartPath(store.id)}
                  className="hidden pt-1 text-center text-sm font-medium text-[var(--store-theme,var(--md-green-700))] hover:underline lg:block"
                >
                  Back to cart
                </Link>
              </aside>
            </div>
          </main>

          <StorefrontMobileActionBar className="min-h-[5.5rem]">
            <p
              className={cn(
                'mb-2 min-h-4 text-center text-xs',
                error ? 'text-[var(--md-danger)]' : 'text-slate-500',
                error || (requiresConsent && !consentAccepted) ? 'visible' : 'invisible',
              )}
              aria-live="polite"
            >
              {error
                ? error
                : requiresConsent && !consentAccepted
                  ? 'Accept the store terms above to continue'
                  : ' '}
            </p>
            <Button
              type="button"
              fullWidth
              size="lg"
              className="h-12 justify-between rounded-full bg-[var(--store-theme,var(--md-green-700))] text-base font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              disabled={!canPlace}
              onClick={() => void placeOrderOnWhatsApp()}
            >
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{placeOrderLabel}</span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Button>
          </StorefrontMobileActionBar>

          <DeliveryAddressPicker {...pickerProps} />
        </>
      )}
    </>
  )
}

function CheckoutSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof MapPin
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="flex gap-3.5 sm:gap-4">
      <span className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-slate-500">{hint}</p> : null}
        <div className="mt-3">{children}</div>
      </div>
    </section>
  )
}

function ChoiceRow({
  checked,
  onChange,
  name,
  title,
  subtitle,
  recommended,
  icon: Icon,
}: {
  checked: boolean
  onChange: () => void
  name: string
  title: string
  subtitle?: string
  recommended?: boolean
  icon?: typeof Banknote
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition',
        checked
          ? 'border-[var(--store-theme,var(--md-green-500))] bg-[var(--store-theme-soft,rgba(16,185,129,0.12))]'
          : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {Icon ? (
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
            checked
              ? 'bg-white/80 text-[var(--store-theme,var(--md-green-700))]'
              : 'bg-slate-100 text-slate-600',
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          {recommended ? (
            <span className="rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.18))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--store-theme,var(--md-green-700))]">
              Suggested
            </span>
          ) : null}
        </span>
        {subtitle ? <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span> : null}
      </span>
      <RadioMark checked={checked} />
    </label>
  )
}

function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2',
        checked
          ? 'border-[var(--store-theme,var(--md-green-600))] bg-[var(--store-theme,var(--md-green-600))] text-white'
          : 'border-slate-300 bg-white',
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
    </span>
  )
}

function ConsentRow({
  title,
  text,
  checked,
  onChange,
}: {
  title: string
  text: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-t border-slate-100 pt-5 sm:pl-[3.75rem]">
      <span
        className={cn(
          'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2',
          checked
            ? 'border-[var(--store-theme,var(--md-green-600))] bg-[var(--store-theme,var(--md-green-600))] text-white'
            : 'border-slate-300 bg-white',
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className="min-w-0 text-sm leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-900">{title}</span>
        {text ? <span className="mt-0.5 block">{text}</span> : null}
      </span>
    </label>
  )
}

function SummaryRow({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd
        className={cn(
          'font-semibold',
          emphasize ? 'text-[var(--store-theme,var(--md-green-700))]' : 'text-slate-900',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
