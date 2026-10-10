import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
} from 'lucide-react'
import {
  apiGet,
  deliveryFeeForCheckout,
  formatDeliveryEstimate,
  getErrorMessage,
  isLiveApi,
  ordersService,
  type StorefrontCheckoutOptions,
  type StorefrontCheckoutPayment,
} from '@/shared/api'
import { ProductImage } from '@/modules/storefront/components/ProductImage'
import { ProductPrice } from '@/modules/storefront/components/ProductPrice'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { StorefrontMobileActionBar } from '@/modules/storefront/components/StorefrontMobileActionBar'
import { lineAmount, priceDetailsFromSummary } from '@/modules/storefront/lib/cart-utils'
import {
  CHECKOUT_ADDRESS_MAP_ENABLED,
  checkoutAddressError,
  checkoutAddressFormFromPin,
  customerNameFromProfile,
  formatCheckoutAddress,
  isCheckoutAddressComplete,
  type CheckoutAddressForm,
} from '@/modules/storefront/lib/checkout-address-form'
import {
  locationMapPath,
  storeCartPath,
  storeOrderSuccessPath,
  storePath,
} from '@/modules/storefront/lib/store-paths'
import {
  buildWhatsAppOrderMessage,
  openWhatsAppChat,
  reserveWhatsAppWindow,
  whatsappSendHref,
} from '@/modules/storefront/lib/whatsapp-order'
import { summaryFromLines, useCartStore } from '@/modules/storefront/store/cart-store'
import type { CartLine, Store } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
import {
  getSelectedAddress,
  useDeliveryAddressStore,
} from '@/shared/store/delivery-address-store'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

const EMPTY_DELIVERY_SLOTS: StorefrontCheckoutOptions['deliverySlots'] = []
const EMPTY_PAYMENT_OPTIONS: StorefrontCheckoutOptions['paymentOptions'] = []
const EMPTY_DELIVERY_METHODS: StorefrontCheckoutOptions['deliveryMethods'] = []
const EMPTY_PICKUP_STORES: StorefrontCheckoutOptions['pickupStores'] = []
const ADDRESS_NOTE_SAVED = 'Check address and items — delivery will be done here.'
const ADDRESS_NOTE_EMPTY = 'Add the address — delivery will be done here.'
const PLACE_ORDER_LABEL = 'Create Order & Send On WhatsApp'
const PICKUP_SLOTS_MISSING =
  'This store has not configured pickup times yet. Choose home delivery or contact the store.'

type CheckoutViewProps = {
  store: Store
  lines: CartLine[]
  cartCount: number
  checkoutOptions?: StorefrontCheckoutOptions | null
  /** True when GET checkout_options failed (e.g. vendor delivery config missing). */
  checkoutUnavailable?: boolean
  onBack: () => void
}

function deliveryMethodLabel(method: StorefrontCheckoutOptions['deliveryMethods'][number]) {
  return method === 'STORE_PICKUP' ? 'Store pickup' : 'Home delivery'
}

function deliveryMethodHint(
  method: StorefrontCheckoutOptions['deliveryMethods'][number],
  options: StorefrontCheckoutOptions | null,
) {
  if (method === 'STORE_PICKUP') {
    return options?.pickupMessage?.trim() || 'Free · Collect from store'
  }
  const charge = options?.shipping.deliveryCharge
  if (charge != null && charge > 0) {
    const threshold = options?.shipping.freeDeliveryThreshold
    if (threshold != null && threshold > 0) {
      return `${formatCurrency(charge)} · Free above ${formatCurrency(threshold)}`
    }
    return `${formatCurrency(charge)} delivery charge`
  }
  return 'Delivered to your address'
}

function paymentIcon(type: StorefrontCheckoutPayment['type'] | undefined) {
  return type === 'CASH_ON_DELIVERY' ? Banknote : CreditCard
}

function checkoutCustomerName(recipient?: string, sessionName?: string) {
  for (const value of [recipient, sessionName]) {
    const name = value?.trim() ?? ''
    if (name && name !== 'User' && name !== 'Vendor') return name
  }
  return undefined
}

function paymentNote(
  option: { type?: string | null; label?: string | null },
  storeName: string,
) {
  const type = option.type?.trim().toUpperCase()
  const label = option.label?.trim().toUpperCase() ?? ''
  if (type === 'CASH_ON_DELIVERY' || label.includes('CASH')) {
    return `Pay ${storeName} when you receive your order.`
  }
  if (type === 'PRE_PAID' || type === 'ONLINE' || type === 'UPI' || label.includes('UPI')) {
    return `Pay ${storeName} directly using any UPI app, like PhonePe, Google Pay, etc.`
  }
  return undefined
}

function hasPrepaidDetails(option: StorefrontCheckoutPayment) {
  return Boolean(option.details?.upiAccount || option.details?.accountHolderName)
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
  const { pathname, search } = useLocation()
  const storedSummary = useCartStore((s) => s.summaries?.[store.id])
  const summary = useMemo(
    () => storedSummary ?? summaryFromLines(lines),
    [storedSummary, lines],
  )

  const user = useAuthStore((s) => s.user)
  const phone = user?.phone ?? ''
  const addresses = useDeliveryAddressStore((s) => s.addresses)
  const selectedId = useDeliveryAddressStore((s) => s.selectedId)
  const updateAddress = useDeliveryAddressStore((s) => s.updateAddress)
  const selected = getSelectedAddress(addresses, selectedId)

  const deliverySlots = checkoutOptions?.deliverySlots ?? EMPTY_DELIVERY_SLOTS
  const paymentOptions = checkoutOptions?.paymentOptions ?? EMPTY_PAYMENT_OPTIONS
  const deliveryMethods = checkoutOptions?.deliveryMethods ?? EMPTY_DELIVERY_METHODS
  const pickupStores = checkoutOptions?.pickupStores ?? EMPTY_PICKUP_STORES
  const estimateDates = checkoutOptions?.availableDeliveryDates ?? []
  const estimateLabel = formatDeliveryEstimate(estimateDates)
  const consentTitle = checkoutOptions?.consentTitle
  const consentText = checkoutOptions?.consentText
  const requiresConsent = Boolean(consentTitle || consentText)

  const defaultPaymentId =
    paymentOptions.find((option) => option.isDefault)?.id ?? paymentOptions[0]?.id ?? ''
  const defaultDeliveryMethod = deliveryMethods[0] ?? 'HOME_DELIVERY'
  const defaultPickupStoreId = pickupStores[0]?.id ?? ''

  const [deliverySlot, setDeliverySlot] = useState(deliverySlots[0]?.id ?? '')
  const [pickupStoreId, setPickupStoreId] = useState(defaultPickupStoreId)
  const [pickupSlot, setPickupSlot] = useState(pickupStores[0]?.pickupSlots[0]?.id ?? '')
  const [payment, setPayment] = useState(defaultPaymentId)
  const [deliveryMethod, setDeliveryMethod] =
    useState<StorefrontCheckoutOptions['deliveryMethods'][number]>(defaultDeliveryMethod)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressForm, setAddressForm] = useState<CheckoutAddressForm | null>(null)
  const [addressError, setAddressError] = useState('')
  const [addressSaving, setAddressSaving] = useState(false)
  const [addressMapPinned, setAddressMapPinned] = useState(false)

  useEffect(() => {
    if (!deliverySlots.some((slot) => slot.id === deliverySlot) && deliverySlots[0]) {
      setDeliverySlot(deliverySlots[0].id)
    }
  }, [deliverySlots, deliverySlot])

  useEffect(() => {
    if (!pickupStores.some((storeOption) => storeOption.id === pickupStoreId) && pickupStores[0]) {
      setPickupStoreId(pickupStores[0].id)
    }
  }, [pickupStores, pickupStoreId])

  const selectedPickupStore =
    pickupStores.find((storeOption) => storeOption.id === pickupStoreId) ?? pickupStores[0] ?? null
  const storePickupSlots = selectedPickupStore?.pickupSlots ?? EMPTY_DELIVERY_SLOTS
  const pickupSlots = storePickupSlots.length > 0 ? storePickupSlots : deliverySlots

  useEffect(() => {
    if (!pickupSlots.some((slot) => slot.id === pickupSlot) && pickupSlots[0]) {
      setPickupSlot(pickupSlots[0].id)
    }
  }, [pickupSlots, pickupSlot])

  useEffect(() => {
    if (!paymentOptions.some((option) => option.id === payment) && defaultPaymentId) {
      setPayment(defaultPaymentId)
    }
  }, [paymentOptions, payment, defaultPaymentId])

  useEffect(() => {
    if (!deliveryMethods.includes(deliveryMethod) && defaultDeliveryMethod) {
      setDeliveryMethod(defaultDeliveryMethod)
    }
  }, [deliveryMethods, deliveryMethod, defaultDeliveryMethod])

  useEffect(() => {
    setConsentAccepted(false)
  }, [consentTitle, consentText])

  const selectedSlot = deliverySlots.find((slot) => slot.id === deliverySlot)
  const selectedPickupSlot = pickupSlots.find((slot) => slot.id === pickupSlot)
  const isStorePickup = deliveryMethod === 'STORE_PICKUP'
  const pickupSlotsConfigured = pickupSlots.length > 0
  const deliveryDate = estimateDates[0] ?? selectedSlot?.date ?? ''
  // Item totals stay on the cart summary. The delivery line comes from checkout_options
  // shipping_config, which the cart payload does not include.
  const totals = useMemo(() => {
    const base = priceDetailsFromSummary(summary)
    if (isStorePickup) {
      return {
        ...base,
        delivery: 0,
        total: base.total - base.delivery,
      }
    }
    const quoted = deliveryFeeForCheckout({
      subtotal: base.subtotal,
      method: deliveryMethod,
      strategy: checkoutOptions?.shippingStrategyType,
      shipping: checkoutOptions?.shipping,
    })
    if (quoted == null) return base
    return {
      ...base,
      delivery: quoted,
      total: base.total - base.delivery + quoted,
    }
  }, [
    summary,
    deliveryMethod,
    isStorePickup,
    checkoutOptions?.shipping,
    checkoutOptions?.shippingStrategyType,
  ])

  const selectedPayment = paymentOptions.find((option) => option.id === payment)
  const selectedPaymentLabel = selectedPayment?.label ?? 'Payment'
  const needsDeliveryAddress = !isStorePickup
  const storePickupPhone = (store.phone || store.supportWhatsapp || '')
    .replace(/\D/g, '')
    .slice(-10)

  const canPlace =
    (needsDeliveryAddress ? Boolean(selected) : true) &&
    !editingAddress &&
    Boolean(estimateLabel || deliverySlot || deliverySlots.length === 0 || isStorePickup) &&
    (!isStorePickup || (pickupSlotsConfigured && Boolean(selectedPickupSlot))) &&
    Boolean(payment || paymentOptions.length === 0) &&
    (!requiresConsent || consentAccepted) &&
    !placing

  function openAddressMap(editId?: string) {
    navigate(locationMapPath(store.id, { from: `${pathname}${search}`, editId }))
  }

  function startAddressEdit() {
    if (!selected) {
      openAddressMap()
      return
    }
    const draft = checkoutAddressFormFromPin({
      userName: user?.name,
      userPhone: phone,
      location: selected.location,
      city: selected.city,
      state: selected.state,
      zipCode: selected.zipCode,
      recipientName: selected.recipientName,
      contactNumber: selected.contactNumber,
      address1: selected.address1,
      address2: selected.address2,
      district: selected.district,
    })
    setAddressForm(draft)
    setAddressError('')
    setAddressMapPinned(
      Number.isFinite(selected.lat) && Number.isFinite(selected.lng),
    )
    setEditingAddress(true)
    if (!draft.name && user?.id) fillNameFromProfile(user.id)
  }

  function fillNameFromProfile(userId: string) {
    if (!isLiveApi()) return
    void apiGet<unknown>(`/v1/users/${userId}`)
      .then((payload) => {
        const name = customerNameFromProfile(payload)
        if (!name) return
        setAddressForm((current) =>
          current && !current.name.trim() ? { ...current, name } : current,
        )
      })
      .catch(() => {
        /* The form stays editable when the profile name cannot be read. */
      })
  }

  function cancelAddressEdit() {
    setEditingAddress(false)
    setAddressForm(null)
    setAddressError('')
    setAddressSaving(false)
    setAddressMapPinned(false)
  }

  async function saveAddressEdit() {
    if (!addressForm || !selected) {
      openAddressMap()
      return
    }

    const problem = checkoutAddressError(addressForm, {
      mapEnabled: CHECKOUT_ADDRESS_MAP_ENABLED,
      mapPinned: addressMapPinned,
    })
    if (problem) {
      setAddressError(problem)
      return
    }

    const location = formatCheckoutAddress(addressForm)
    const next = {
      location,
      lat: selected.lat,
      lng: selected.lng,
      city: addressForm.city.trim(),
      country: selected.country || 'India',
      zipCode: addressForm.zipCode.trim(),
      state: addressForm.state.trim(),
      district: addressForm.district.trim() || undefined,
      address1: addressForm.address1.trim(),
      address2: addressForm.address2.trim() || undefined,
      recipientName: addressForm.name.trim(),
      contactNumber: addressForm.contactNumber.trim(),
      backendAddressId: selected.backendAddressId,
    }

    setAddressSaving(true)
    setAddressError('')
    try {
      if (user?.id && isLiveApi()) {
        const backendAddressId = await ordersService.updateCustomerDeliveryAddress({
          userId: user.id,
          name: next.recipientName,
          location: next.location,
          lat: next.lat,
          lng: next.lng,
          city: next.city,
          country: next.country,
          zipCode: next.zipCode,
          state: next.state,
          district: next.district,
          address1: next.address1,
          address2: next.address2,
          setAsDefault: false,
        })
        if (backendAddressId) next.backendAddressId = backendAddressId
      }

      updateAddress(selected.id, next)
      setEditingAddress(false)
      setAddressForm(null)
      setAddressMapPinned(false)
      setError('')
    } catch (err) {
      setAddressError(getErrorMessage(err))
    } finally {
      setAddressSaving(false)
    }
  }

  async function placeOrderOnWhatsApp() {
    if (editingAddress) {
      setError('Save your delivery address to continue.')
      return
    }
    if (needsDeliveryAddress && !selected) {
      setError('Add a delivery address to continue.')
      openAddressMap()
      return
    }
    if (isStorePickup && !pickupSlotsConfigured) {
      setError(PICKUP_SLOTS_MISSING)
      return
    }
    if (isStorePickup && !selectedPickupSlot) {
      setError('Choose a pickup time to continue.')
      return
    }
    if (requiresConsent && !consentAccepted) {
      setError('Please accept the store terms to continue.')
      return
    }

    const whatsappWindow = reserveWhatsAppWindow(store.theme?.primaryColor)
    setPlacing(true)
    setError('')
    try {
      const order = await ordersService.placeOrder({
        storeId: store.id,
        storeName: store.name,
        address: selected?.location ?? store.name,
        phone: selected?.contactNumber || phone,
        note: [
          isStorePickup ? 'Method: Store pickup' : null,
          selectedPickupSlot
            ? `Slot: ${selectedPickupSlot.label}`
            : selectedSlot
              ? `Slot: ${selectedSlot.label}`
              : null,
          `Payment: ${selectedPaymentLabel}`,
        ]
          .filter(Boolean)
          .join(' · '),
        lines,
        deliveryFee: totals.delivery,
        total: totals.total,
        userId: user?.id,
        userName: selected?.recipientName || user?.name,
        addressId: selected?.backendAddressId ?? selected?.id,
        lat: selected?.lat,
        lng: selected?.lng,
        city: selected?.city,
        country: selected?.country,
        zipCode: selected?.zipCode,
        address1: selected?.address1,
        address2: selected?.address2,
        district: selected?.district,
        state: selected?.state,
        deliveryMethod,
        deliveryDate: isStorePickup ? undefined : deliveryDate,
        orderTimingType: checkoutOptions?.schedulingStrategy,
        paymentTypeId: selectedPayment?.id ?? payment,
        pickupAddressId: selectedPickupStore?.id,
        pickupSlot: selectedPickupSlot?.label,
      })

      if (order.addressId && selected) {
        useDeliveryAddressStore.getState().updateAddress(selected.id, {
          location: selected.location,
          lat: selected.lat,
          lng: selected.lng,
          city: selected.city,
          country: selected.country,
          zipCode: selected.zipCode,
          state: selected.state,
          district: selected.district,
          address1: selected.address1,
          address2: selected.address2,
          recipientName: selected.recipientName,
          contactNumber: selected.contactNumber,
          backendAddressId: order.addressId,
        })
      }

      const message = buildWhatsAppOrderMessage({
        orderId: order.id,
        storeName: store.name,
        customerName: checkoutCustomerName(selected?.recipientName, user?.name),
        location: selected?.location ?? (isStorePickup ? 'Store pickup' : ''),
        phone: selected?.contactNumber || phone,
        address1: selected?.address1,
        address2: selected?.address2,
        city: selected?.city,
        district: selected?.district,
        state: selected?.state,
        zipCode: selected?.zipCode,
        lines,
        subtotal: totals.subtotal,
        deliveryFee: totals.delivery,
        packagingFee: totals.packaging,
        discount: totals.discount,
        serviceFee: totals.service,
        total: totals.total,
        paymentLabel: selectedPaymentLabel,
        deliveryMethodLabel: deliveryMethodLabel(deliveryMethod),
        deliverySlotLabel: selectedPickupSlot?.label ?? selectedSlot?.label,
        deliveryDateLabel: isStorePickup ? undefined : estimateLabel || deliveryDate || undefined,
      })

      const waLink = whatsappSendHref(store.phone ?? '', message)
      openWhatsAppChat(waLink, whatsappWindow)

      navigate(storeOrderSuccessPath(store.id, order.id), {
        replace: true,
        state: {
          storeName: store.name,
          whatsappMessage: message,
          whatsappHref: waLink,
        },
      })
    } catch (err) {
      whatsappWindow?.close()
      setError(getErrorMessage(err, 'Could not place order'))
    } finally {
      setPlacing(false)
    }
  }

  const itemLabel = `${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'} in your cart`

  return (
    <>
      <StorefrontHeader store={store} cartCount={cartCount} />

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
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
                  Review Order
                </h1>

                {deliveryMethods.length > 0 ? (
                  <CheckoutSection title="Delivery Method" icon={Truck}>
                    <div className="space-y-2.5">
                      {deliveryMethods.map((method) => (
                        <ChoiceRow
                          key={method}
                          checked={deliveryMethod === method}
                          onChange={() => setDeliveryMethod(method)}
                          name="delivery-method"
                          title={deliveryMethodLabel(method)}
                          subtitle={deliveryMethodHint(method, checkoutOptions)}
                          icon={method === 'STORE_PICKUP' ? StoreIcon : Truck}
                        />
                      ))}
                    </div>
                  </CheckoutSection>
                ) : null}

                {!isStorePickup ? (
                <CheckoutSection
                  icon={MapPin}
                  title="Delivering here"
                  hint={selected ? ADDRESS_NOTE_SAVED : ADDRESS_NOTE_EMPTY}
                  action={
                    !editingAddress && selected ? (
                      <button
                        type="button"
                        onClick={startAddressEdit}
                        className="inline-flex shrink-0 items-center text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
                      >
                        Edit
                      </button>
                    ) : null
                  }
                >
                  {editingAddress && addressForm ? (
                    <AddressEditor
                      value={addressForm}
                      error={addressError}
                      mapEnabled={CHECKOUT_ADDRESS_MAP_ENABLED}
                      mapPinned={addressMapPinned}
                      saving={addressSaving}
                      onChange={(next) => {
                        setAddressForm(next)
                        if (addressError) setAddressError('')
                      }}
                      onCancel={cancelAddressEdit}
                      onSave={() => {
                        void saveAddressEdit()
                      }}
                      onPinMap={() => {
                        setAddressMapPinned(true)
                        openAddressMap(selected?.id)
                      }}
                    />
                  ) : selected ? (
                    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--store-theme,#10b981)_28%,#ffffff)] bg-[linear-gradient(135deg,var(--store-theme-soft,rgba(16,185,129,0.12)),#ffffff)] px-4 py-3.5 shadow-sm">
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--store-theme,var(--md-green-700))]">
                        Home
                      </p>
                      {selected.recipientName ? (
                        <p className="mt-1 text-sm font-bold text-slate-900">{selected.recipientName}</p>
                      ) : null}
                      <p
                        className={cn(
                          'whitespace-pre-wrap text-[0.9rem] font-semibold leading-snug text-slate-900',
                          selected.recipientName ? 'mt-0.5' : 'mt-1',
                        )}
                      >
                        {selected.location}
                      </p>
                      {selected.contactNumber ? (
                        <p className="mt-1.5 text-xs text-slate-500">+91 {selected.contactNumber}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
                      <p className="text-sm text-slate-600">Add your delivery address</p>
                      <Button
                        type="button"
                        className="mt-4 rounded-xl bg-[var(--store-theme,var(--md-green-800))] px-6 text-white hover:opacity-90"
                        onClick={() => openAddressMap()}
                      >
                        Add address
                      </Button>
                    </div>
                  )}
                </CheckoutSection>
                ) : (
                  <CheckoutSection
                    icon={StoreIcon}
                    title="Store pickup"
                    hint={
                      checkoutOptions?.pickupMessage?.trim() ||
                      'Pickup is free. Collect your order from the store.'
                    }
                  >
                    {pickupStores.length > 1 ? (
                      <div className="mb-3 space-y-2.5">
                        {pickupStores.map((storeOption) => (
                          <ChoiceRow
                            key={storeOption.id}
                            checked={selectedPickupStore?.id === storeOption.id}
                            onChange={() => setPickupStoreId(storeOption.id)}
                            name="pickup-store"
                            title={storeOption.name}
                            subtitle={storeOption.address ?? undefined}
                            icon={StoreIcon}
                          />
                        ))}
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--store-theme,#10b981)_28%,#ffffff)] bg-[linear-gradient(135deg,var(--store-theme-soft,rgba(16,185,129,0.12)),#ffffff)] px-4 py-3.5 shadow-sm">
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--store-theme,var(--md-green-700))]">
                        In-store
                      </p>
                      <p className="mt-1 text-[0.9rem] font-semibold leading-snug text-slate-900">
                        {selectedPickupStore?.name ?? store.name}
                      </p>
                      {(selectedPickupStore?.address || store.location) ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                          {selectedPickupStore?.address || store.location}
                        </p>
                      ) : null}
                      {selectedPickupStore?.readyInMinutes != null ? (
                        <p className="mt-1.5 text-xs text-slate-500">
                          Ready in about {selectedPickupStore.readyInMinutes} minutes
                        </p>
                      ) : null}
                      {storePickupPhone.length === 10 ? (
                        <p className="mt-1.5 text-xs text-slate-500">Contact: +91 {storePickupPhone}</p>
                      ) : null}
                    </div>
                    {!pickupSlotsConfigured ? (
                      <p className="mt-3 text-sm text-amber-800">{PICKUP_SLOTS_MISSING}</p>
                    ) : null}
                  </CheckoutSection>
                )}

                {isStorePickup && pickupSlotsConfigured ? (
                  <CheckoutSection title="Pickup time" icon={CalendarDays}>
                    <SlotChipGrid
                      name="pickup-slot"
                      slots={pickupSlots}
                      selectedId={pickupSlot}
                      onSelect={setPickupSlot}
                    />
                  </CheckoutSection>
                ) : null}

                {!isStorePickup && deliverySlots.length > 0 ? (
                  <CheckoutSection title="Delivery time" icon={CalendarDays}>
                    <SlotChipGrid
                      name="delivery-slot"
                      slots={deliverySlots}
                      selectedId={deliverySlot}
                      onSelect={setDeliverySlot}
                    />
                  </CheckoutSection>
                ) : null}

                {paymentOptions.length > 0 ? (
                  <CheckoutSection title="Payment" icon={CreditCard}>
                    <div className="space-y-2.5">
                      {paymentOptions.map((option) => (
                        <PaymentOptionCard
                          key={option.id}
                          option={option}
                          checked={payment === option.id}
                          storeName={store.name}
                          onSelect={() => setPayment(option.id)}
                        />
                      ))}
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
                      return (
                        <div key={line.itemId} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                          <ProductImage
                            src={line.imageUrl}
                            alt=""
                            className="size-14 shrink-0 rounded-xl"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                              {line.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">Qty {line.qty}</p>
                          </div>
                          <ProductPrice
                            price={lineAmount(line)}
                            listPrice={
                              line.listPrice != null && line.listPrice > line.price
                                ? line.listPrice * line.qty
                                : undefined
                            }
                            size="sm"
                            className="shrink-0 flex-col items-end gap-0"
                          />
                        </div>
                      )
                    })}
                  </div>

                  <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                    <SummaryRow label="Item total (MRP)" value={formatCurrency(totals.subtotal)} />
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

                  {selectedPayment ? (
                    <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--store-theme-soft,rgba(16,185,129,0.1))] px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
                      <ShieldCheck
                        className="mt-0.5 size-3.5 shrink-0 text-[var(--store-theme,var(--md-green-700))]"
                        aria-hidden
                      />
                      <span>{selectedPaymentLabel}</span>
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
                  className="hidden h-auto min-h-12 justify-between rounded-full bg-[var(--store-theme,var(--md-green-700))] px-5 py-2.5 text-base font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 lg:inline-flex"
                  disabled={!canPlace}
                  onClick={() => void placeOrderOnWhatsApp()}
                >
                  <PlaceOrderCta placing={placing} />
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

          <StorefrontMobileActionBar>
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
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-slate-600">Total</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {formatCurrency(totals.total)}
              </span>
            </div>
            <Button
              type="button"
              fullWidth
              size="lg"
              className="h-auto min-h-12 justify-center gap-2 rounded-full bg-[var(--store-theme,var(--md-green-700))] px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              disabled={!canPlace}
              onClick={() => void placeOrderOnWhatsApp()}
            >
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 text-balance text-center text-sm font-semibold leading-snug">
                {placing ? 'Creating order…' : PLACE_ORDER_LABEL}
              </span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Button>
          </StorefrontMobileActionBar>
        </>
      )}
    </>
  )
}

function PlaceOrderCta({ placing }: { placing: boolean }) {
  return (
    <>
      <ShieldCheck className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug">
        {placing ? 'Creating order…' : PLACE_ORDER_LABEL}
      </span>
      <ChevronRight className="size-4 shrink-0" aria-hidden />
    </>
  )
}

function CheckoutSection({
  icon: Icon,
  title,
  hint,
  action,
  children,
}: {
  icon: typeof MapPin
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex gap-3.5 sm:gap-4">
      <span className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          {action}
        </div>
        {hint ? <p className="mt-0.5 text-sm text-slate-500">{hint}</p> : null}
        <div className="mt-3">{children}</div>
      </div>
    </section>
  )
}

function SlotChipGrid({
  name,
  slots,
  selectedId,
  onSelect,
}: {
  name: string
  slots: StorefrontCheckoutOptions['deliverySlots']
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        slots.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3',
      )}
      role="radiogroup"
      aria-label={name === 'pickup-slot' ? 'Pickup time' : 'Delivery time'}
    >
      {slots.map((slot) => {
        const checked = selectedId === slot.id
        return (
          <label
            key={slot.id}
            className={cn(
              'flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3.5 text-center transition sm:py-4',
              checked
                ? 'border-[var(--store-theme,var(--md-green-500))] bg-[var(--store-theme-soft,rgba(16,185,129,0.12))] text-[var(--store-theme,var(--md-green-800))]'
                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300',
            )}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onSelect(slot.id)}
              className="sr-only"
            />
            <span className="text-sm font-semibold leading-none">{slot.label}</span>
          </label>
        )
      })}
    </div>
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

function FieldLabel({
  htmlFor,
  label,
  children,
  className,
}: {
  htmlFor: string
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}{' '}
        <abbr className="text-[var(--md-danger)] no-underline" title="Required">
          *
        </abbr>
      </span>
      {children}
    </label>
  )
}

const fieldClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--store-theme,var(--md-green-600))] focus:ring-2 focus:ring-[var(--store-theme-soft,rgba(16,185,129,0.45))]'

function AddressEditor({
  value,
  error,
  mapEnabled,
  mapPinned,
  saving,
  onChange,
  onCancel,
  onSave,
  onPinMap,
}: {
  value: CheckoutAddressForm
  error: string
  mapEnabled: boolean
  mapPinned: boolean
  saving: boolean
  onChange: (value: CheckoutAddressForm) => void
  onCancel: () => void
  onSave: () => void
  onPinMap: () => void
}) {
  const canSave =
    isCheckoutAddressComplete(value, { mapEnabled, mapPinned }) && !saving

  return (
    <div data-map-enabled={mapEnabled ? 'true' : 'false'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel htmlFor="checkout-addr-name" label="Name">
          <input
            id="checkout-addr-name"
            value={value.name}
            autoFocus
            autoComplete="name"
            aria-required
            aria-label="Name"
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            className={cn(fieldClassName, 'h-11')}
          />
        </FieldLabel>
        <FieldLabel htmlFor="checkout-addr-phone" label="Phone number">
          <input
            id="checkout-addr-phone"
            value={value.contactNumber}
            autoComplete="tel"
            inputMode="numeric"
            maxLength={10}
            aria-required
            aria-label="Phone number"
            placeholder="10-digit mobile"
            onChange={(event) =>
              onChange({
                ...value,
                contactNumber: event.target.value.replace(/\D/g, '').slice(0, 10),
              })
            }
            className={cn(fieldClassName, 'h-11')}
          />
        </FieldLabel>
        <FieldLabel htmlFor="checkout-addr-text" label="Address" className="sm:col-span-2">
          <textarea
            id="checkout-addr-text"
            value={value.address1}
            rows={2}
            autoComplete="street-address"
            aria-required
            aria-label="Address"
            placeholder="House, street, locality"
            onChange={(event) =>
              onChange({ ...value, address1: event.target.value, address2: '' })
            }
            className={cn(fieldClassName, 'min-h-[4.5rem] resize-y py-2.5')}
          />
        </FieldLabel>
        <FieldLabel htmlFor="checkout-addr-city" label="City">
          <input
            id="checkout-addr-city"
            value={value.city}
            autoComplete="address-level2"
            aria-required
            aria-label="City"
            onChange={(event) => onChange({ ...value, city: event.target.value })}
            className={cn(fieldClassName, 'h-11')}
          />
        </FieldLabel>
        <FieldLabel htmlFor="checkout-addr-district" label="District">
          <input
            id="checkout-addr-district"
            value={value.district}
            aria-required
            aria-label="District"
            onChange={(event) => onChange({ ...value, district: event.target.value })}
            className={cn(fieldClassName, 'h-11')}
          />
        </FieldLabel>
        <FieldLabel htmlFor="checkout-addr-state" label="State">
          <input
            id="checkout-addr-state"
            value={value.state}
            autoComplete="address-level1"
            aria-required
            aria-label="State"
            onChange={(event) => onChange({ ...value, state: event.target.value })}
            className={cn(fieldClassName, 'h-11')}
          />
        </FieldLabel>
        <FieldLabel htmlFor="checkout-addr-zip" label="ZIP code">
          <input
            id="checkout-addr-zip"
            value={value.zipCode}
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={6}
            aria-required
            aria-label="ZIP code"
            placeholder="6-digit PIN"
            onChange={(event) =>
              onChange({
                ...value,
                zipCode: event.target.value.replace(/\D/g, '').slice(0, 6),
              })
            }
            className={cn(fieldClassName, 'h-11')}
          />
        </FieldLabel>
      </div>

      {mapEnabled ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600">
            Google Map{' '}
            <abbr className="text-[var(--md-danger)] no-underline" title="Required">
              *
            </abbr>
          </p>
          <button
            type="button"
            onClick={onPinMap}
            className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:border-slate-300"
          >
            <MapPin className="size-3.5" aria-hidden />
            Pin on Google Map
          </button>
          {mapPinned ? (
            <p className="mt-2 text-xs font-medium text-slate-600">Location pinned</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-[var(--md-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full border-slate-200 px-5 text-slate-800"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11 rounded-full bg-[var(--store-theme,var(--md-green-800))] px-5 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSave}
          disabled={!canSave}
        >
          {saving ? 'Saving…' : 'Save address'}
        </Button>
      </div>
    </div>
  )
}

function PaymentOptionCard({
  option,
  checked,
  storeName,
  onSelect,
}: {
  option: StorefrontCheckoutPayment
  checked: boolean
  storeName: string
  onSelect: () => void
}) {
  const Icon = paymentIcon(option.type)
  const subtitle = paymentNote(option, storeName)
  const showDetails =
    checked &&
    (option.type === 'PRE_PAID' || option.type === 'ONLINE') &&
    hasPrepaidDetails(option)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border transition',
        checked
          ? 'border-[var(--store-theme,var(--md-green-500))] bg-[var(--store-theme-soft,rgba(16,185,129,0.12))]'
          : 'border-slate-200 bg-white',
      )}
    >
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
        <input
          type="radio"
          name="payment-method"
          checked={checked}
          onChange={onSelect}
          className="sr-only"
        />
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
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
          {subtitle ? <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span> : null}
        </span>
        <RadioMark checked={checked} />
      </label>

      {showDetails && option.details ? (
        <div className="px-4 pb-3.5">
          <PrepaidPaymentDetails details={option.details} />
        </div>
      ) : null}
    </div>
  )
}

function PrepaidPaymentDetails({
  details,
}: {
  details: NonNullable<StorefrontCheckoutPayment['details']>
}) {
  const [copied, setCopied] = useState(false)
  const upi = details.upiAccount?.trim() ?? ''
  const holder = details.accountHolderName?.trim() ?? ''

  async function copyUpi() {
    if (!upi || !navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(upi)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* Clipboard may be blocked; the UPI id stays visible to copy manually. */
    }
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm">
      {holder ? (
        <div>
          <p className="text-xs font-medium text-slate-500">Name</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{holder}</p>
        </div>
      ) : null}
      {upi ? (
        <div className={cn(holder ? 'mt-2.5' : undefined)}>
          <p className="text-xs font-medium text-slate-500">UPI ID</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
              {upi}
            </p>
            <button
              type="button"
              onClick={() => void copyUpi()}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label={copied ? 'UPI ID copied' : 'Copy UPI ID'}
              title={copied ? 'Copied' : 'Copy'}
            >
              {copied ? (
                <Check className="size-4 text-[var(--store-theme,var(--md-green-700))]" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
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
    <div className="border-t border-slate-100 pt-5">
      <label className="flex cursor-pointer gap-3.5 sm:gap-4">
        <span className="flex size-11 shrink-0 justify-end">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="sr-only"
          />
          <span
            className={cn(
              'mt-0.5 inline-flex size-5 items-center justify-center rounded-[5px] border-2',
              checked
                ? 'border-[var(--store-theme,var(--md-green-600))] bg-[var(--store-theme,var(--md-green-600))] text-white'
                : 'border-slate-300 bg-white',
            )}
          >
            {checked ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
          </span>
        </span>
        <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">
          <span className="block font-semibold text-slate-900">{title}</span>
          {text ? <span className="mt-0.5 block">{text}</span> : null}
        </span>
      </label>
    </div>
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
