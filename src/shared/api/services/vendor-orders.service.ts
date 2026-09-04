import type {
  DeliveryStatus,
  PaymentStatus,
  VendorOrderDetail,
  VendorOrderPage,
} from '@/modules/vendor/types/dashboard'
import { apiGet, apiPatch } from '../client'
import { demoVendorOrderDetail, demoVendorOrdersPage } from '../fixtures/vendor-dashboard'
import { mapVendorOrderDetail, mapVendorOrderPage } from '../mappers/vendor-dashboard'
import { isLiveApi } from '../mode'

const DEMO_LATENCY_MS = 150
const PAGE_SIZE = 20

function demoDelay() {
  return new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS))
}

export type VendorOrderQuery = {
  page?: number
  status?: DeliveryStatus | null
  startDate?: string | null
  endDate?: string | null
}

/**
 * One page of orders.
 *
 * Filtering and paging are the server's job: the endpoint takes `order_status`,
 * `start_date`, `end_date`, `page` and `size`, so a filtered view costs one request
 * rather than fetching everything and narrowing it in the browser.
 */
export async function listVendorOrders(
  vendorId: string | number,
  query: VendorOrderQuery = {},
): Promise<VendorOrderPage> {
  const page = query.page ?? 0

  if (!isLiveApi()) {
    await demoDelay()
    return mapVendorOrderPage(demoVendorOrdersPage(page, PAGE_SIZE, query.status ?? undefined))
  }

  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (query.status) params.set('order_status', query.status)
  if (query.startDate) params.set('start_date', query.startDate)
  if (query.endDate) params.set('end_date', query.endDate)

  return mapVendorOrderPage(await apiGet(`/v1/vendors/${vendorId}/orders/?${params}`))
}

/**
 * One order with its lines.
 *
 * The list read carries headers only, so line items need this second endpoint — which is
 * why order detail is its own route rather than an inline expand.
 */
export async function getVendorOrder(
  vendorId: string | number,
  orderId: string,
): Promise<VendorOrderDetail | null> {
  if (!isLiveApi()) {
    await demoDelay()
    const fixture = demoVendorOrderDetail(orderId)
    return fixture ? mapVendorOrderDetail(fixture) : null
  }
  return mapVendorOrderDetail(await apiGet(`/v1/vendors/${vendorId}/orders/${orderId}/items`))
}

/**
 * Move an order along, or mark it paid.
 *
 * The write takes `delivery_status` and `payment_status` — not the `status` key the
 * previous implementation sent, which the backend simply ignored.
 *
 * `SHIPPED` is set here directly rather than through `POST /orders/{id}/tracking`, which
 * would also set it but demands a `courier_partner_id` that no endpoint lists. That path
 * is recorded as a gap; taking it now would mean asking for an id we cannot offer.
 */
export async function updateVendorOrder(
  vendorId: string | number,
  orderId: string,
  update: { deliveryStatus?: DeliveryStatus; paymentStatus?: PaymentStatus },
): Promise<void> {
  if (!isLiveApi()) {
    await demoDelay()
    return
  }
  const body: Record<string, string> = {}
  if (update.deliveryStatus) body.delivery_status = update.deliveryStatus
  if (update.paymentStatus) body.payment_status = update.paymentStatus
  await apiPatch(`/v1/vendors/${vendorId}/orders/${orderId}`, body)
}

/**
 * Cancel an order.
 *
 * Its own endpoint, and note the body key: `cancelReason` in camelCase, where the update
 * and bulk endpoints both use `cancel_reason`. The inconsistency is the backend's.
 */
export async function cancelVendorOrder(
  vendorId: string | number,
  orderId: string,
  reason: string,
): Promise<void> {
  if (!isLiveApi()) {
    await demoDelay()
    return
  }
  await apiPatch(`/v1/vendors/${vendorId}/orders/${orderId}/cancel`, { cancelReason: reason })
}

export const vendorOrdersService = {
  list: listVendorOrders,
  get: getVendorOrder,
  update: updateVendorOrder,
  cancel: cancelVendorOrder,
}
