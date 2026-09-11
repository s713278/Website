import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Banknote,
  Check,
  CreditCard,
  MessageCircle,
  Truck,
} from 'lucide-react'
import { getErrorMessage, ordersService } from '@/shared/api'
import { DeliveryAddressCard } from '@/shared/components/DeliveryAddressCard'
import { DeliveryAddressPicker } from '@/shared/components/DeliveryAddressPicker'
import { useDeliveryLocation } from '@/shared/hooks/useDeliveryLocation'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import {
  STOREFRONT_MOBILE_ACTION_PAD,
  StorefrontMobileActionBar,
} from '@/modules/storefront/components/StorefrontMobileActionBar'
import {
  cartTotals,
  findProductForCartLine,
} from '@/modules/storefront/lib/cart-utils'
import {
  DELIVERY_SLOTS,
  PAYMENT_OPTIONS,
  deliverySlotLabel,
  paymentOptionLabel,
  type DeliverySlotId,
  type PaymentOptionId,
} from '@/modules/storefront/lib/checkout-options'
import {
  storeCartPath,
  storeOrderSuccessPath,
} from '@/modules/storefront/lib/store-paths'
import { buildWhatsAppOrderMessage } from '@/modules/storefront/lib/whatsapp-order'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { CartLine, Store } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

type CheckoutViewProps = {
  store: Store
  lines: CartLine[]
  cartCount: number
  onBack: () => void
}

export function CheckoutView({ store, lines, cartCount, onBack }: CheckoutViewProps) {
  const navigate = useNavigate()
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.price * line.qty, 0),
    [lines],
  )
  const clear = useCartStore((s) => s.clear)
  const user = useAuthStore((s) => s.user)
  const phone = user?.phone ?? ''
  const { selected, pickerProps, openChange, openMap } = useDeliveryLocation(store.id)
  const totals = cartTotals(subtotal, lines.length > 0)

  const [deliverySlot, setDeliverySlot] = useState<DeliverySlotId>('6-9pm')
  const [payment, setPayment] = useState<PaymentOptionId>('cod')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  const slotLabel = useMemo(() => deliverySlotLabel(deliverySlot), [deliverySlot])

  async function placeOrderOnWhatsApp() {
    if (!selected) {
      setError('Add a delivery location to continue.')
      openMap()
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
        note: `Slot: ${slotLabel} · Payment: ${paymentOptionLabel(payment)}`,
        lines,
        deliveryFee: totals.delivery,
        total: totals.total,
      })

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
        paymentLabel: paymentOptionLabel(payment),
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

  return (
    <>
      <StorefrontHeader
        storeName={store.name}
        logoUrl={store.theme?.logoImage}
        cartCount={cartCount}
        cartHref={storeCartPath(store.id)}
        searchOpen={false}
        onToggleSearch={onBack}
        pageTitle="Checkout"
        onBack={onBack}
      />

      <main className={cn('store-shell-inner flex-1 py-5 sm:py-6', STOREFRONT_MOBILE_ACTION_PAD)}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <div className="space-y-4">
            <CheckoutSection
              step={1}
              title="Delivery location"
              subtitle="Pin your delivery location on the map"
            >
              {selected ? (
                <DeliveryAddressCard
                  address={selected}
                  onEdit={openChange}
                  changeLabel="Change"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                  <p className="text-sm text-slate-600">Add where we should deliver your order.</p>
                  <Button
                    type="button"
                    className="mt-3 rounded-lg bg-[var(--store-theme,var(--md-green-800))] px-6 text-white hover:opacity-90"
                    onClick={() => openMap()}
                  >
                    Add location
                  </Button>
                </div>
              )}
            </CheckoutSection>

            <CheckoutSection step={2} title="Delivery Slot" subtitle="Choose a convenient delivery time">
              <div className="space-y-3">
                {DELIVERY_SLOTS.map((slot) => (
                  <SlotOption
                    key={slot.id}
                    checked={deliverySlot === slot.id}
                    onChange={() => setDeliverySlot(slot.id)}
                    label={slot.label}
                    description={slot.description}
                    recommended={'recommended' in slot && slot.recommended}
                  />
                ))}
              </div>
            </CheckoutSection>

            <CheckoutSection step={3} title="Payment Method" subtitle="Select your preferred payment method">
              <div className="space-y-3">
                {PAYMENT_OPTIONS.map((option) => (
                  <PaymentOption
                    key={option.id}
                    checked={payment === option.id}
                    onChange={() => setPayment(option.id)}
                    label={option.label}
                    icon={option.id === 'cod' ? Banknote : CreditCard}
                  />
                ))}
              </div>
            </CheckoutSection>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-bold text-slate-900">Order Summary</h2>
              </div>

              <div className="divide-y divide-slate-100 px-5">
                {lines.map((line) => {
                  const product = findProductForCartLine(store.products, line.itemId)
                  return (
                    <div key={line.itemId} className="flex gap-3 py-4">
                      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {product?.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xl">🥒</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{line.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Qty: {line.qty}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-slate-900">
                        {formatCurrency(line.price * line.qty)}
                      </p>
                    </div>
                  )
                })}
              </div>

              <dl className="space-y-2.5 border-t border-slate-100 px-5 py-4 text-sm">
                <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
              </dl>

              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">Total</span>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[var(--store-theme,var(--md-green-700))]">
                      {formatCurrency(totals.total)}
                    </p>
                    <p className="text-xs text-slate-500">(Inclusive of all taxes)</p>
                  </div>
                </div>
              </div>

              <div className="mx-5 mb-5 flex items-start gap-2.5 rounded-xl bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] px-3.5 py-3 text-sm text-[var(--store-theme,var(--md-green-800))]">
                <Truck className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  Your order will be delivered <strong>{slotLabel}</strong>.
                </p>
              </div>
            </div>

            {error ? <p className="hidden text-sm text-[var(--md-danger)] lg:block">{error}</p> : null}

            <Button
              type="button"
              fullWidth
              size="lg"
              className="hidden h-12 rounded-[var(--store-button-radius,0.75rem)] bg-[var(--store-theme,var(--md-green-800))] text-base font-semibold text-white shadow-sm hover:opacity-90 lg:inline-flex"
              disabled={placing}
              onClick={() => void placeOrderOnWhatsApp()}
            >
              <MessageCircle className="size-4" aria-hidden />
              {placing ? 'Placing order…' : `Place order on WhatsApp · ${formatCurrency(totals.total)}`}
            </Button>

            <Link
              to={storeCartPath(store.id)}
              className="hidden pt-1 text-center text-sm font-medium text-slate-500 hover:text-[var(--store-theme,var(--md-green-700))] lg:block"
            >
              Back to cart
            </Link>
          </aside>
        </div>
      </main>

      <StorefrontMobileActionBar>
        {error ? <p className="mb-2 text-sm text-[var(--md-danger)]">{error}</p> : null}
        <Button
          type="button"
          fullWidth
          size="lg"
          className="h-12 rounded-[var(--store-button-radius,0.75rem)] bg-[var(--store-theme,var(--md-green-800))] text-base font-semibold text-white shadow-sm hover:opacity-90"
          disabled={placing}
          onClick={() => void placeOrderOnWhatsApp()}
        >
          <MessageCircle className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {placing ? 'Placing order…' : `Place order · ${formatCurrency(totals.total)}`}
          </span>
        </Button>
      </StorefrontMobileActionBar>

      <DeliveryAddressPicker {...pickerProps} />
    </>
  )
}

function CheckoutSection({
  step,
  title,
  subtitle,
  children,
}: {
  step: number
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--store-theme,var(--md-green-800))] text-sm font-bold text-white">
          {step}
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function SlotOption({
  checked,
  onChange,
  label,
  description,
  recommended,
}: {
  checked: boolean
  onChange: () => void
  label: string
  description: string
  recommended?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition',
        checked
          ? 'border-[var(--store-theme,var(--md-green-600))] bg-[var(--store-theme-soft,rgba(16,185,129,0.1))]'
          : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <input type="radio" name="delivery-slot" checked={checked} onChange={onChange} className="sr-only" />
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
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{label}</span>
          {recommended ? (
            <span className="rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.18))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--store-theme,var(--md-green-700))]">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
    </label>
  )
}

function PaymentOption({
  checked,
  onChange,
  label,
  icon: Icon,
}: {
  checked: boolean
  onChange: () => void
  label: string
  icon: typeof Banknote
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition',
        checked
          ? 'border-[var(--store-theme,var(--md-green-600))] bg-[var(--store-theme-soft,rgba(16,185,129,0.1))]'
          : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <input type="radio" name="payment-method" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-lg',
          checked
            ? 'bg-[var(--store-theme-soft,rgba(16,185,129,0.18))] text-[var(--store-theme,var(--md-green-700))]'
            : 'bg-slate-100 text-slate-600',
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{label}</span>
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
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
