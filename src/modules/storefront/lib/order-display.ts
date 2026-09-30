import { getStoreById } from '@/modules/storefront/data/catalog'
import { findProductForCartLine } from '@/modules/storefront/lib/cart-utils'
import type { Product } from '@/modules/storefront/types'
import { formatDeliveryEstimate } from '@/shared/api/mappers/storefront-checkout'
import type { CustomerOrder, CustomerOrderItem } from '@/shared/api/services/orders.service'

function dateFromIso(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(year!, month! - 1, day)
  }
  return new Date(iso)
}

/** `Sun, 27 Sept, 2026` — order-details receipt style. */
export function formatOrderDay(iso: string) {
  const date = dateFromIso(iso)
  const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date)
  const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric' }).format(date)
  const month = new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date)
  const year = new Intl.DateTimeFormat('en-IN', { year: 'numeric' }).format(date)
  return `${weekday}, ${day} ${month}, ${year}`
}

export function formatOrderDate(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatOrderDay(iso)
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function deliveryMethodLabel(method?: string) {
  if (!method) return ''
  const key = method.toUpperCase()
  if (key === 'HOME_DELIVERY') return 'Home delivery'
  if (key === 'STORE_PICKUP') return 'Store pickup'
  return method.replaceAll('_', ' ')
}

export const DELIVERY_ESTIMATE_NOTE = 'May arrive a little earlier or later.'

export function deliveryEstimateFromNotes(notes?: string) {
  const match = notes?.match(/Estimated delivery:\s*([^·\n]+)/i)
  const label = match?.[1]?.trim()
  return label || ''
}

/** Range from checkout notes, else a single known delivery_date — never a made-up window. */
export function orderArrivalLabel(order: Pick<CustomerOrder, 'notes' | 'deliveryDate'>) {
  return (
    deliveryEstimateFromNotes(order.notes) ||
    (order.deliveryDate ? formatDeliveryEstimate([order.deliveryDate]) : '')
  )
}

export function paymentNotesWithoutEstimate(notes?: string) {
  if (!notes) return ''
  return notes.replace(/Estimated delivery:\s*[^·\n]+(?:\s*·\s*)?/i, '').trim()
}

export function paymentStatusLabel(status?: string) {
  if (!status) return ''
  const key = status.toUpperCase()
  if (key === 'DUE') return 'Payment due'
  if (key === 'PAID') return 'Paid'
  return status.replaceAll('_', ' ')
}

export function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    placed: 'Placed',
    scheduled: 'Scheduled',
    pending: 'Placed',
    preparing: 'Preparing',
    on_the_way: 'On the way',
    delivered: 'Delivered',
  }
  const key = status.toLowerCase()
  return labels[key] ?? status.replaceAll('_', ' ')
}

function findProductByItemName(products: Product[], itemName: string) {
  const title = itemName.replace(/\s*\([^)]+\)$/, '').trim()
  return products.find((product) => product.name === title)
}

export function resolveOrderItemImage(
  order: Pick<CustomerOrder, 'storeId' | 'items'>,
  item: CustomerOrderItem,
): string | undefined {
  if (item.imageUrl) return item.imageUrl
  if (!order.storeId) return undefined

  const store = getStoreById(order.storeId)
  if (!store) return undefined

  if (item.itemId) {
    return findProductForCartLine(store.products, item.itemId)?.imageUrl
  }

  return findProductByItemName(store.products, item.name)?.imageUrl
}

export function orderPrimaryImage(order: CustomerOrder): string | undefined {
  const first = order.items[0]
  if (!first) return undefined
  return resolveOrderItemImage(order, first)
}

/** MRP line total when `list_price` is higher than what was paid. */
export function lineMrpTotal(item: CustomerOrderItem): number | undefined {
  if (item.listPrice == null) return undefined
  const paid = item.lineTotal ?? (item.unitPrice ?? 0) * item.qty
  const mrp = item.listPrice * item.qty
  return mrp > paid ? mrp : undefined
}

/** Order MRP from `order_amount.gross_amount` or item list prices. */
export function orderMrpTotal(order: CustomerOrder): number | undefined {
  if (order.bill && order.bill.grossAmount > order.total) return order.bill.grossAmount
  const fromItems = order.items.reduce((sum, item) => {
    if (item.listPrice == null) return sum
    return sum + item.listPrice * item.qty
  }, 0)
  return fromItems > order.total ? fromItems : undefined
}

export function orderItemsSummary(items: CustomerOrderItem[]) {
  const qty = items.reduce((sum, item) => sum + item.qty, 0)
  const first = items[0]
  const unitMatch = first?.name.match(/\(([^)]+)\)$/)
  return {
    qty,
    title: first?.name.replace(/\s*\([^)]+\)$/, '').trim() ?? 'Order items',
    unit: first?.size ?? unitMatch?.[1] ?? '',
  }
}
