import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, CreditCard, Home, MapPin, Receipt, ShoppingBag, Truck } from 'lucide-react'
import { ordersService, getErrorMessage, type CustomerOrder } from '@/shared/api'
import { ProductImage } from '@/modules/storefront/components/ProductImage'
import { ProductPrice } from '@/modules/storefront/components/ProductPrice'
import {
  StorefrontMobileActionBar,
} from '@/modules/storefront/components/StorefrontMobileActionBar'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { WhatsAppActionLink } from '@/modules/storefront/components/WhatsAppIcon'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import {
  DELIVERY_ESTIMATE_NOTE,
  deliveryMethodLabel,
  lineMrpTotal,
  orderArrivalLabel,
  orderStatusLabel,
  paymentNotesWithoutEstimate,
  paymentStatusLabel,
  resolveOrderItemImage,
} from '@/modules/storefront/lib/order-display'
import {
  canChatAboutOrder,
  orderOwnerChatHref,
} from '@/modules/storefront/lib/order-owner-chat'
import { customerLoginLink } from '@/modules/storefront/lib/cart-nav'
import { canShopAsCustomer } from '@/modules/storefront/lib/request-add-to-cart'
import { storeOrderPath, storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, EmptyState, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

export function OrderDetailPage() {
  const { storeId = '', orderId = '' } = useParams()
  const user = useAuthStore((s) => s.user)
  const { store, loading: storeLoading, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [orderLoading, setOrderLoading] = useState(true)
  const [orderError, setOrderError] = useState('')

  useEffect(() => {
    if (!orderId) return
    if (!canShopAsCustomer(user)) {
      setOrder(null)
      setOrderError('')
      setOrderLoading(false)
      return
    }
    let cancelled = false
    setOrderLoading(true)
    void ordersService
      .getMyOrder(user?.id, orderId)
      .then((data) => {
        if (cancelled) return
        if (data?.storeId && data.storeId !== storeId) {
          setOrder(null)
          setOrderError('Order not found')
          return
        }
        setOrder(data)
        if (!data) setOrderError('Order not found')
      })
      .catch((err) => {
        if (!cancelled) setOrderError(getErrorMessage(err, 'Could not load this order'))
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId, storeId, user])

  const itemCount = useCartStore((s) => s.itemCount(storeId))

  if (!storeId || !orderId) return <Navigate to="/orders" replace />

  const shopName = store?.name ?? order?.storeName ?? 'Order details'
  const shopHref = storePath(storeId)
  const login = customerLoginLink(storeOrderPath(storeId, orderId), {
    name: shopName,
    logoUrl: store?.theme?.logoImage,
  })
  const chatHref =
    order && store && canChatAboutOrder(order.status)
      ? orderOwnerChatHref(store, order.id, shopName)
      : null
  const showStickyFooter = Boolean(order)

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      <StorefrontHeader
        store={store}
        storeId={storeId}
        storeName={shopName}
        storeLoading={storeLoading}
        cartCount={itemCount}
      />

      <main
        className={cn(
          'store-shell-inner flex-1 py-4 sm:py-6',
          showStickyFooter
            ? chatHref
              ? 'pb-40 sm:pb-44 lg:pb-8'
              : 'pb-28 sm:pb-32 lg:pb-8'
            : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        <div className="mx-auto w-full max-w-lg space-y-3">
          {!canShopAsCustomer(user) ? (
            <EmptyState
              title="Sign in to see this order"
              description="Use the Sign in button in the header to view your order."
              action={
                <Link to={login.to} state={login.state}>
                  <Button>Sign in</Button>
                </Link>
              }
            />
          ) : orderLoading ? (
            <div className="py-16">
              <Spinner label="Loading order…" />
            </div>
          ) : order ? (
            <>
              <StatusCard order={order} />
              <StoreRow order={order} href={shopHref} />
              <ItemsAndBillCard order={order} />
              <AddressRow order={order} />
              <PaymentRow order={order} />

              <div className="hidden gap-2 pt-2 pb-6 lg:flex lg:flex-col">
                {chatHref ? (
                  <WhatsAppActionLink
                    href={chatHref}
                    className="w-full bg-[var(--store-theme,var(--md-green-700))] text-white shadow-sm hover:opacity-90"
                  >
                    Chat with Owner
                  </WhatsAppActionLink>
                ) : null}
                <Link
                  to={shopHref}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Continue shopping
                  <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                </Link>
              </div>
            </>
          ) : (
            <EmptyState
              title={orderError || 'Order not found'}
              description="This order may belong to another account."
            />
          )}
        </div>
      </main>

      {showStickyFooter && order ? (
        <StorefrontMobileActionBar className="lg:hidden">
          <div className="flex flex-col gap-2">
            {chatHref ? (
              <WhatsAppActionLink
                href={chatHref}
                className="w-full bg-[var(--store-theme,var(--md-green-700))] text-white shadow-sm hover:opacity-90"
              >
                Chat with Owner
              </WhatsAppActionLink>
            ) : null}
            <Link
              to={shopHref}
              className={cn(
                'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold',
                chatHref
                  ? 'border border-slate-200 bg-white text-slate-700'
                  : 'bg-[var(--store-theme,var(--md-green-700))] text-white',
              )}
            >
              {!chatHref ? <ShoppingBag className="size-4" strokeWidth={2} aria-hidden /> : null}
              Continue shopping
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </StorefrontMobileActionBar>
      ) : null}
    </div>
  )
}

function cardClass(extra?: string) {
  return cn(
    'rounded-[1.5rem] bg-white px-4 py-4 shadow-[0_1px_10px_rgba(15,23,42,0.05)] sm:px-5',
    extra,
  )
}

function StatusCard({ order }: { order: CustomerOrder }) {
  const estimate = orderArrivalLabel(order)
  return (
    <section className={cardClass('relative overflow-hidden bg-[var(--store-theme-soft,#f3fbf6)] shadow-none')}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-slate-900">Order #{order.id}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-[var(--store-theme,var(--md-green-700))] ring-1 ring-[var(--store-theme-muted,rgba(16,185,129,0.25))]">
          <span className="size-1.5 rounded-full bg-[var(--store-theme,var(--md-green-500))]" aria-hidden />
          {orderStatusLabel(order.status)}
        </span>
      </div>
      <p className="mt-2 max-w-[16rem] text-lg font-bold leading-snug text-slate-900 sm:max-w-none sm:text-xl">
        {estimate ? `Estimated delivery: ${estimate}` : 'Order received'}
      </p>
      {estimate ? <p className="mt-1 text-[13px] text-slate-500">{DELIVERY_ESTIMATE_NOTE}</p> : null}
      {order.deliveryMethod ? (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500">
          <Home className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {deliveryMethodLabel(order.deliveryMethod)}
        </p>
      ) : null}
      <Truck
        className="pointer-events-none absolute right-4 top-5 size-12 text-[var(--store-theme,var(--md-green-500))] sm:right-6 sm:size-14"
        strokeWidth={1.5}
        aria-hidden
      />
    </section>
  )
}

function StoreRow({ order, href }: { order: CustomerOrder; href: string }) {
  return (
    <Link to={href} className={cardClass('flex items-center gap-3')}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
        <Home className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{order.storeName}</span>
        <span className="mt-0.5 block text-xs text-slate-500">Back to store</span>
      </span>
    </Link>
  )
}

function ItemsAndBillCard({ order }: { order: CustomerOrder }) {
  const count = order.items.length
  const bill = order.bill
  return (
    <section className={cardClass()}>
      <h2 className="text-sm font-bold text-slate-900">
        {count} {count === 1 ? 'item' : 'items'}
      </h2>
      {order.items.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {order.items.map((item, index) => {
            const imageUrl = resolveOrderItemImage(order, item)
            return (
              <li key={`${item.itemId ?? item.name}-${index}`} className="flex gap-3">
                <ProductImage
                  src={imageUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-xl ring-1 ring-slate-100 sm:size-[3.75rem]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  {item.size ? <p className="mt-0.5 text-xs text-slate-500">{item.size}</p> : null}
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-xs text-slate-500">
                    <span>Qty {item.qty}</span>
                    {item.unitPrice != null ? (
                      <>
                        <span>×</span>
                        <ProductPrice
                          price={item.unitPrice}
                          listPrice={item.listPrice}
                          size="sm"
                          saleClassName="text-xs font-medium text-slate-500"
                        />
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <ProductPrice
                    price={item.lineTotal ?? (item.unitPrice ?? 0) * item.qty}
                    listPrice={lineMrpTotal(item)}
                    size="sm"
                    className="flex-col items-end gap-0"
                  />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No items listed.</p>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Receipt className="size-4 text-slate-400" strokeWidth={1.75} aria-hidden />
          Bill details
        </h3>
        {bill ? (
          <>
            <dl className="mt-3 space-y-2.5 text-sm">
              <BillRow label="Item total (MRP)" value={formatCurrency(bill.grossAmount)} />
              {bill.discount > 0 ? (
                <BillRow label="Discount" value={`- ${formatCurrency(bill.discount)}`} accent />
              ) : null}
              <BillRow
                label="Delivery"
                value={bill.deliveryCharges > 0 ? formatCurrency(bill.deliveryCharges) : 'Free'}
                accent={bill.deliveryCharges === 0}
              />
              {bill.serviceCharge > 0 ? (
                <BillRow label="Service charge" value={formatCurrency(bill.serviceCharge)} />
              ) : null}
              {bill.taxAmount > 0 ? <BillRow label="Tax" value={formatCurrency(bill.taxAmount)} /> : null}
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3 text-sm font-bold">
              <span>To pay</span>
              <ProductPrice
                price={bill.amount}
                listPrice={bill.grossAmount > bill.amount ? bill.grossAmount : undefined}
                size="sm"
                saleClassName="text-sm font-bold text-[var(--store-theme,var(--md-green-600))]"
              />
            </div>
          </>
        ) : (
          <div className="mt-3 flex justify-between text-sm font-bold">
            <span>To pay</span>
            <span className="text-[var(--store-theme,var(--md-green-600))]">{formatCurrency(order.total)}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function AddressRow({ order }: { order: CustomerOrder }) {
  if (!order.addressLine && !order.customerMobile && !order.customerName) return null
  const name = order.customerName && order.customerName !== 'User' ? order.customerName : null
  const phone = order.customerMobile ? `+91 ${order.customerMobile}` : null
  return (
    <section className={cardClass('flex items-start gap-3')}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
        <MapPin className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Delivery details</p>
        {order.addressLine ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{order.addressLine}</p>
        ) : null}
        {name || phone ? (
          <p className="mt-0.5 text-xs text-slate-500">
            {name}
            {name && phone ? ' · ' : null}
            {phone}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function PaymentRow({ order }: { order: CustomerOrder }) {
  const extra = paymentNotesWithoutEstimate(order.notes)
  const paymentLine =
    extra || (order.paymentStatus ? paymentStatusLabel(order.paymentStatus) : '')
  if (!paymentLine) return null
  return (
    <section className={cardClass('flex items-start gap-3')}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
        <CreditCard className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Payment</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{paymentLine}</p>
      </div>
    </section>
  )
}

function BillRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn(accent ? 'font-medium text-[var(--store-theme,var(--md-green-600))]' : 'text-slate-800')}>
        {value}
      </dd>
    </div>
  )
}
