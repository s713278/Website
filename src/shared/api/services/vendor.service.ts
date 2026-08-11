import { VENDOR_ORDERS, VENDOR_PRODUCTS } from '@/modules/vendor/data/demo'
import type { StoreTheme } from '@/modules/storefront/types'
import { apiGet, unwrapData } from '../client'
import { useLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'
import { mapVendorTheme } from './catalog.service'

export type VendorDashboardStats = {
  openOrders: number
  availableItems: number
  todayRevenue: number
  storeName: string
  online: boolean
  theme?: StoreTheme
}

export async function getVendorDashboard(vendorId: string | number): Promise<VendorDashboardStats> {
  if (!useLiveApi()) {
    await new Promise((r) => setTimeout(r, 200))
    return {
      openOrders: VENDOR_ORDERS.filter((o) => o.status !== 'completed').length,
      availableItems: VENDOR_PRODUCTS.filter((p) => p.available).length,
      todayRevenue: VENDOR_ORDERS.reduce((sum, order) => sum + order.total, 0),
      storeName: 'Green Bowl Kitchen',
      online: true,
      theme: { primaryColor: '#10b981', accentColor: '#f97316' },
    }
  }

  const [vendorRes, ordersRes, productsRes] = await Promise.all([
    apiGet<ApiEnvelope<Record<string, unknown>>>(`/v1/vendors/${vendorId}`),
    apiGet<ApiEnvelope<unknown>>(`/v1/vendors/${vendorId}/orders/`).catch(() => null),
    apiGet<ApiEnvelope<unknown>>(`/v1/vendors/${vendorId}/products`).catch(() => null),
  ])

  const vendor = unwrapData(vendorRes) || {}
  const ordersRaw = ordersRes ? unwrapData(ordersRes) : []
  const productsRaw = productsRes ? unwrapData(productsRes) : []
  const orders = Array.isArray(ordersRaw) ? ordersRaw : []
  const products = Array.isArray(productsRaw) ? productsRaw : []

  return {
    openOrders: orders.filter((order) => {
      const status = String((order as Record<string, unknown>).status ?? '')
      return status && status !== 'completed' && status !== 'CANCELLED'
    }).length,
    availableItems: products.filter((product) => {
      const row = product as Record<string, unknown>
      return row.available !== false && row.status !== 'INACTIVE'
    }).length,
    todayRevenue: orders.reduce(
      (sum, order) => sum + Number((order as Record<string, unknown>).total ?? 0),
      0,
    ),
    storeName: String(vendor.business_name ?? vendor.name ?? 'Your store'),
    online: String(vendor.vendor_status ?? 'ONLINE').toUpperCase() !== 'OFFLINE',
    theme: mapVendorTheme(vendor),
  }
}

export const vendorService = {
  getDashboard: getVendorDashboard,
}
