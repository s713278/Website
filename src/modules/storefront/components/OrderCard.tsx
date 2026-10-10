import { Link } from 'react-router-dom'
import type { CustomerOrder } from '@/shared/api'
import { ProductImage } from '@/modules/storefront/components/ProductImage'
import { ProductPrice } from '@/modules/storefront/components/ProductPrice'
import { WhatsAppActionLink } from '@/modules/storefront/components/WhatsAppIcon'
import {
  orderArrivalLabel,
  orderItemsSummary,
  orderMrpTotal,
  orderPrimaryImage,
  orderStatusLabel,
} from '@/modules/storefront/lib/order-display'
import {
  canChatAboutOrder,
  orderOwnerChatHref,
} from '@/modules/storefront/lib/order-owner-chat'
import { storeOrderPath } from '@/modules/storefront/lib/store-paths'
import type { Store } from '@/modules/storefront/types'
import { cn } from '@/lib/utils'

type OrderCardProps = {
  order: CustomerOrder
  storeId?: string
  store?: Pick<Store, 'name' | 'supportWhatsapp' | 'phone'> | null
}

export function OrderCard({ order, storeId, store }: OrderCardProps) {
  const summary = orderItemsSummary(order.items)
  const imageUrl = orderPrimaryImage(order)
  const shopId = order.storeId || storeId
  const detailHref = shopId ? storeOrderPath(shopId, order.id) : '/orders'
  const extraItems = Math.max(0, order.items.length - 1)
  const estimate = orderArrivalLabel(order)
  const shopName = store?.name ?? order.storeName
  const chatHref =
    canChatAboutOrder(order.status) && store
      ? orderOwnerChatHref(store, order.id, shopName)
      : null

  return (
    <article className="rounded-xl bg-white p-3.5 ring-1 ring-slate-100 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">Order #{order.id}</p>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-2.5 flex gap-3">
        <ProductImage
          src={imageUrl}
          alt=""
          className="size-12 shrink-0 rounded-lg ring-1 ring-slate-100 sm:size-14"
        />
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chatHref ? (
          <WhatsAppActionLink
            href={chatHref}
            className="min-h-11 flex-1 border border-[var(--store-theme,var(--md-green-600))] bg-white text-[var(--store-theme,var(--md-green-800))] hover:bg-[var(--store-theme-soft,rgba(16,185,129,0.1))] sm:flex-none"
          >
            Chat with Owner
          </WhatsAppActionLink>
        ) : null}
        <Link
          to={detailHref}
          className={cn(
            'inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline',
            chatHref ? 'sm:px-2' : 'min-h-8 px-0',
          )}
        >
          View details
        </Link>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase().replace(/[\s-]+/g, '_')
  const muted = key === 'DELIVERED' || key === 'CANCELLED' || key === 'CANCELED'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
        muted
          ? 'bg-slate-100 text-slate-600'
          : 'bg-[var(--store-theme-soft,#ecfdf5)] text-[var(--store-theme,var(--md-green-700))]',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          muted ? 'bg-slate-400' : 'bg-[var(--store-theme,var(--md-green-600))]',
        )}
      />
      {orderStatusLabel(status)}
    </span>
  )
}
