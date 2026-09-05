import { getStoreById } from '@/modules/storefront/data/catalog'
import { findProductForCartLine } from '@/modules/storefront/lib/cart-utils'
import type { Product } from '@/modules/storefront/types'
import type { CustomerOrder, CustomerOrderItem } from '@/shared/api/services/orders.service'

export function formatOrderDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function formatDeliveryWindow(placedAt: string) {
  const start = new Date(placedAt)
  start.setDate(start.getDate() + 2)
  const end = new Date(placedAt)
  end.setDate(end.getDate() + 4)
  const fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}

export function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    placed: 'Placed',
    preparing: 'Preparing',
    on_the_way: 'On the way',
    delivered: 'Delivered',
  }
  return labels[status] ?? status.replaceAll('_', ' ')
}

export function isPastOrder(status: string) {
  return status === 'delivered'
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

export function orderItemsSummary(items: CustomerOrderItem[]) {
  const qty = items.reduce((sum, item) => sum + item.qty, 0)
  const first = items[0]
  const unitMatch = first?.name.match(/\(([^)]+)\)$/)
  return {
    qty,
    title: first?.name.replace(/\s*\([^)]+\)$/, '').trim() ?? 'Order items',
    unit: unitMatch?.[1] ?? '',
  }
}
