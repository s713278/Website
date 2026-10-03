import { Link } from 'react-router-dom'
import type { CustomerOrder } from '@/shared/api'
import { ProductImage } from '@/modules/storefront/components/ProductImage'
import { ProductPrice } from '@/modules/storefront/components/ProductPrice'
import {
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
    <article className="rounded-xl bg-white p-3.5 ring-1 ring-slate-100 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">Order #{order.id}</p>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-2.5 flex gap-3">
        <ProductImage src={imageUrl} alt="" className="size-12 shrink-0 rounded-lg ring-1 ring-slate-100 sm:size-14" />
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
            className="mt-1"
          />
        </div>
      </div>

      {estimate ? (
        <p className="mt-2 text-xs font-medium leading-snug text-slate-700">
          Estimated delivery: {estimate}
        </p>
      ) : null}

      <Link
        to={detailHref}
        className="mt-1.5 inline-flex min-h-8 items-center text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
      >
        View details
      </Link>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const delivered = status.toUpperCase() === 'DELIVERED'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
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
