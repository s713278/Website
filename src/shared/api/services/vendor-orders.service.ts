import { VENDOR_ORDERS } from '@/modules/vendor/data/demo'
import type { VendorOrder, VendorOrderStatus } from '@/modules/vendor/types'
import { apiGet, apiPatch, unwrapData } from '../client'
import { isLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'

const DEMO_KEY = 'md-vendor-orders'

function readDemo(): VendorOrder[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw) as VendorOrder[]
  } catch {
    /* fall through */
  }
  return structuredClone(VENDOR_ORDERS)
}

function writeDemo(orders: VendorOrder[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(orders))
}

export async function listVendorOrders(vendorId: string | number): Promise<VendorOrder[]> {
  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 200))
    return readDemo()
  }

  const res = await apiGet<ApiEnvelope<unknown>>(`/v1/vendors/${vendorId}/orders/`)
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
      customerName: String(item.customer_name ?? item.customerName ?? 'Customer'),
      items: Array.isArray(item.items)
        ? (item.items as Array<Record<string, unknown>>).map((line) => ({
            name: String(line.name ?? line.product_name ?? 'Item'),
            qty: Number(line.qty ?? line.quantity ?? 1),
          }))
        : [],
      total: Number(item.total ?? 0),
      status: String(item.status ?? 'new') as VendorOrderStatus,
      placedAt: String(item.created_at ?? item.placedAt ?? new Date().toISOString()),
    }))
}

export async function updateVendorOrderStatus(
  vendorId: string | number,
  orderId: string,
  status: VendorOrderStatus,
): Promise<VendorOrder | null> {
  if (!isLiveApi()) {
    const orders = readDemo()
    const next = orders.map((order) => (order.id === orderId ? { ...order, status } : order))
    writeDemo(next)
    return next.find((order) => order.id === orderId) ?? null
  }

  const res = await apiPatch<ApiEnvelope<Record<string, unknown>>>(
    `/v1/vendors/${vendorId}/orders/${orderId}`,
    { status },
  )
  const data = unwrapData(res) || {}
  return {
    id: String(data.id ?? orderId),
    customerName: String(data.customer_name ?? 'Customer'),
    items: [],
    total: Number(data.total ?? 0),
    status: String(data.status ?? status) as VendorOrderStatus,
    placedAt: String(data.created_at ?? new Date().toISOString()),
  }
}

export const vendorOrdersService = {
  list: listVendorOrders,
  updateStatus: updateVendorOrderStatus,
}
