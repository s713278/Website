import { VENDOR_ORDERS, VENDOR_PRODUCTS } from '@/modules/vendor/data/demo'
import type { StoreTheme } from '@/modules/storefront/types'
import { apiGet, unwrapData } from '../client'
import { mapVendorTheme, vendorCollectionRows } from '../mappers/vendor'
import { isLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'

export type VendorDashboardStats = {
  openOrders: number
  availableItems: number
  todayRevenue: number
  storeName: string
  online: boolean
  theme?: StoreTheme
}

export async function getVendorDashboard(vendorId: string | number): Promise<VendorDashboardStats> {
  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 200))
    return {
      openOrders: VENDOR_ORDERS.filter((o) => o.status !== 'completed').length,
      availableItems: VENDOR_PRODUCTS.filter((p) => p.available).length,
      todayRevenue: VENDOR_ORDERS.reduce((sum, order) => sum + order.total, 0),
      storeName: 'Green Bowl Kitchen',
      online: true,
      theme: {
        primaryColor: '#10b981',
        accentColor: '#f97316',
        backgroundColor: '#f9fafb',
        fontFamily: 'Poppins',
      },
    }
  }

  const [vendorRes, ordersRes, productsRes] = await Promise.all([
    apiGet<ApiEnvelope<Record<string, unknown>>>(`/v1/vendors/${vendorId}`),
    apiGet<ApiEnvelope<unknown>>(`/v1/vendors/${vendorId}/orders/`).catch(() => null),
    apiGet<ApiEnvelope<unknown>>(`/v1/vendors/${vendorId}/products`).catch(() => null),
  ])

  const vendor = unwrapData(vendorRes) || {}
  // `/products` answers `data: []` but `/orders/` answers a paginated container, so the
  // shape has to be normalized rather than assumed. These counts therefore describe the
  // first page of orders only (20 rows); a vendor past that is undercounted until the
  // dashboard reads a server-side aggregate.
  const orders = vendorCollectionRows(ordersRes ? unwrapData(ordersRes) : [])
  const products = vendorCollectionRows(productsRes ? unwrapData(productsRes) : [])

  return {
    openOrders: orders.filter((order) => {
      const status = String(order.status ?? '')
      return status && status !== 'completed' && status !== 'CANCELLED'
    }).length,
    availableItems: products.filter((product) => {
      return product.available !== false && product.status !== 'INACTIVE'
    }).length,
    todayRevenue: orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
    storeName: String(vendor.business_name ?? vendor.name ?? 'Your store'),
    online: String(vendor.vendor_status ?? 'ONLINE').toUpperCase() !== 'OFFLINE',
    theme: mapVendorTheme(vendor),
  }
}

export const vendorService = {
  getDashboard: getVendorDashboard,
}
