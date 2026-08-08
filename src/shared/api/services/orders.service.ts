import type { CartLine } from '@/modules/storefront/types'
import { apiGet, apiPost, unwrapData } from '../client'
import { useLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'

export type CustomerOrder = {
  id: string
  storeName: string
  total: number
  status: 'placed' | 'preparing' | 'on_the_way' | 'delivered' | string
  placedAt: string
  items: Array<{ name: string; qty: number }>
}

export type PlaceOrderInput = {
  storeId: string
  storeName: string
  address: string
  phone: string
  note?: string
  lines: CartLine[]
  deliveryFee: number
  total: number
}

const ORDERS_KEY = 'md-customer-orders'

function readDemoOrders(): CustomerOrder[] {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '[]') as CustomerOrder[]
  } catch {
    return []
  }
}

function writeDemoOrders(orders: CustomerOrder[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

export async function placeOrder(input: PlaceOrderInput): Promise<CustomerOrder> {
  if (!useLiveApi()) {
    await new Promise((r) => setTimeout(r, 400))
    const order: CustomerOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      storeName: input.storeName,
      total: input.total,
      status: 'placed',
      placedAt: new Date().toISOString(),
      items: input.lines.map((line) => ({ name: line.name, qty: line.qty })),
    }
    writeDemoOrders([order, ...readDemoOrders()])
    return order
  }

  const res = await apiPost<ApiEnvelope<Record<string, unknown>>>('/v1/orders', {
    vendor_id: input.storeId,
    delivery_address: input.address,
    phone: input.phone,
    note: input.note,
    items: input.lines.map((line) => ({
      product_id: line.itemId,
      quantity: line.qty,
      unit_price: line.price,
    })),
  })

  const data = unwrapData(res) || {}
  return {
    id: String(data.id ?? data.order_id ?? `ORD-${Date.now()}`),
    storeName: input.storeName,
    total: Number(data.total ?? input.total),
    status: String(data.status ?? 'placed'),
    placedAt: String(data.created_at ?? new Date().toISOString()),
    items: input.lines.map((line) => ({ name: line.name, qty: line.qty })),
  }
}

export async function listMyOrders(userId?: string): Promise<CustomerOrder[]> {
  if (!useLiveApi()) {
    await new Promise((r) => setTimeout(r, 200))
    return readDemoOrders().map((order) => ({
      ...order,
      storeName:
        order.storeName ||
        (order as { restaurantName?: string }).restaurantName ||
        'Store',
    }))
  }

  if (!userId) return []
  const res = await apiGet<ApiEnvelope<unknown>>(`/v1/users/${userId}/orders/history`)
  const data = unwrapData(res)
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { content?: unknown[] })?.content)
      ? (data as { content: unknown[] }).content
      : []

  return list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      storeName: String(item.vendor_name ?? item.storeName ?? item.restaurantName ?? 'Store'),
      total: Number(item.total ?? 0),
      status: String(item.status ?? 'placed'),
      placedAt: String(item.created_at ?? item.placedAt ?? new Date().toISOString()),
      items: Array.isArray(item.items)
        ? (item.items as Array<Record<string, unknown>>).map((line) => ({
            name: String(line.name ?? line.product_name ?? 'Item'),
            qty: Number(line.qty ?? line.quantity ?? 1),
          }))
        : [],
    }))
}

export const ordersService = {
  placeOrder,
  listMyOrders,
}
