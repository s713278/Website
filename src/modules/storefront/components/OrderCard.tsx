import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, Clock, Headphones, Package } from 'lucide-react'
import type { CustomerOrder } from '@/shared/api'
import {
  formatDeliveryWindow,
  formatOrderDate,
  orderItemsSummary,
  orderPrimaryImage,
  orderStatusLabel,
} from '@/modules/storefront/lib/order-display'
import { storeOrderSuccessPath } from '@/modules/storefront/lib/store-paths'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

type OrderCardProps = {
  order: CustomerOrder
}

export function OrderCard({ order }: OrderCardProps) {
  const summary = orderItemsSummary(order.items)
  const imageUrl = orderPrimaryImage(order)
  const detailHref = order.storeId
    ? storeOrderSuccessPath(order.storeId, order.id)
    : '/orders'

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--md-green-50,#ecfdf5)] text-[var(--md-green-700,#047857)]">
            <Package className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{order.storeName}</p>
            <p className="mt-0.5 break-all text-xs text-slate-500 sm:text-sm">
              {order.id} · {formatOrderDate(order.placedAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:px-5">
        <div className="flex gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            {imageUrl ? (
              <img src={imageUrl} alt={summary.title} className="size-full object-cover" loading="lazy" />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl">🥒</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {summary.qty}× {summary.title}
            </p>
            {summary.unit ? <p className="mt-0.5 text-xs text-slate-500">{summary.unit}</p> : null}
            <p className="mt-2 inline-block rounded-md bg-[var(--md-green-50,#ecfdf5)] px-2 py-0.5 text-sm font-bold text-[var(--md-green-700,#047857)]">
              {formatCurrency(order.total)}
            </p>
          </div>
        </div>

        <div className="hidden h-16 w-px bg-slate-100 sm:block" aria-hidden />

        <div className="flex gap-3 sm:pl-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
            <ClipboardList className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Order placed</p>
            <p className="text-xs text-slate-500">We&apos;ve received your order</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <span>
                Estimated delivery{' '}
                <strong className="text-[var(--md-green-700,#047857)]">
                  {formatDeliveryWindow(order.placedAt)}
                </strong>
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
        <Link
          to={detailHref}
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-[var(--md-green-700,#047857)] hover:underline"
        >
          View order details
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <Link
          to="/stores"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--md-green-700,#047857)] px-3 py-1.5 text-xs font-semibold text-[var(--md-green-700,#047857)] transition hover:bg-[var(--md-green-50,#ecfdf5)]"
        >
          <Headphones className="size-3.5" aria-hidden />
          Need help?
        </Link>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const delivered = status === 'delivered'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        delivered
          ? 'bg-slate-100 text-slate-600'
          : 'bg-[var(--md-green-50,#ecfdf5)] text-[var(--md-green-700,#047857)]',
      )}
    >
      <span className={cn('size-1.5 rounded-full', delivered ? 'bg-slate-400' : 'bg-[var(--md-green-600,#059669)]')} />
      {orderStatusLabel(status)}
    </span>
  )
}
