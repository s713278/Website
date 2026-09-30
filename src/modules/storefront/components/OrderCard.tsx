import { Link } from 'react-router-dom'
import type { CustomerOrder } from '@/shared/api'
import { ProductPrice } from '@/modules/storefront/components/ProductPrice'
import {
  DELIVERY_ESTIMATE_NOTE,
  orderArrivalLabel,
  orderItemsSummary,
  orderMrpTotal,
  orderPrimaryImage,
  orderStatusLabel,
} from '@/modules/storefront/lib/order-display'
import { storeOrderPath } from '@/modules/storefront/lib/store-paths'
import { cn } from '@/lib/utils'

type OrderCardProps = {
  order: CustomerOrder
  storeId?: string
}

export function OrderCard({ order, storeId }: OrderCardProps) {
  const summary = orderItemsSummary(order.items)
  const imageUrl = orderPrimaryImage(order)
  const shopId = order.storeId || storeId
  const detailHref = shopId ? storeOrderPath(shopId, order.id) : '/orders'
  const extraItems = Math.max(0, order.items.length - 1)
  const estimate = orderArrivalLabel(order)

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_10px_rgba(15,23,42,0.05)] ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <p className="text-xs font-medium text-slate-500">Order #{order.id}</p>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex gap-3 px-4 py-3 sm:px-5">
        <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100 sm:size-16">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center text-xl">🛒</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{summary.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {summary.unit ? `${summary.unit} · ` : null}
            Qty {summary.qty}
            {extraItems > 0 ? ` · +${extraItems} more` : null}
          </p>
          <ProductPrice
            price={order.total}
            listPrice={orderMrpTotal(order)}
            size="sm"
            className="mt-1.5"
          />
        </div>
      </div>

      {estimate ? (
        <div className="px-4 sm:px-5">
          <p className="text-xs font-medium text-slate-700">Estimated delivery: {estimate}</p>
          <p className="mt-0.5 text-xs text-slate-500">{DELIVERY_ESTIMATE_NOTE}</p>
        </div>
      ) : null}

      <div className="px-4 py-3 sm:px-5">
        <Link
          to={detailHref}
          className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
        >
          View details
        </Link>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const delivered = status.toUpperCase() === 'DELIVERED'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        delivered
          ? 'bg-slate-100 text-slate-600'
          : 'bg-[var(--store-theme-soft,#ecfdf5)] text-[var(--store-theme,var(--md-green-700))]',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          delivered ? 'bg-slate-400' : 'bg-[var(--store-theme,var(--md-green-600))]',
        )}
      />
      {orderStatusLabel(status)}
    </span>
  )
}
