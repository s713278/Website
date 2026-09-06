import type {
  DeliveryStatus,
  PaymentStatus,
  VendorOrderDetail,
  VendorOrderPage,
} from '@/modules/vendor/types/dashboard'
import { apiGet, apiPatch } from '../client'
import { updateDemoOrder } from '../fixtures/demo-state'
import { demoVendorOrderDetail, demoVendorOrdersPage } from '../fixtures/vendor-dashboard'
import { mapVendorOrderDetail, mapVendorOrderPage } from '../mappers/vendor-dashboard'
import { isLiveApi } from '../mode'
import { demoDelay } from './demo-delay'

/** The page size `GET /v1/vendors/{id}/orders/` serves; the list pages through it. */
const PAGE_SIZE = 20

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
    return mapVendorOrderPage(
      demoVendorOrdersPage(page, PAGE_SIZE, {
        status: query.status ?? undefined,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
    )
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
 * **This live path does not work and is being replaced.** `PATCH /v1/vendors/{v}/orders/{id}`
 * returns 417 for every body, including `{}` — Jackson cannot instantiate its request DTO,
 * so it fails before the order id is even looked up. Both the advance and mark-paid controls
 * currently call it.
 *
 * The replacement for advancing is `POST /v1/vendors/{v}/orders/bulk-status-update` with a
 * single id, which works but only one hop at a time. Note when wiring it: a refused
 * transition arrives as **HTTP 200 with `success_count: 0`**, so a caller that checks only
 * the status code reports a silent no-op as success. There is no replacement for marking an
 * order paid — no route can set `payment_status`.
 *
 * See `docs/VENDOR_CONSOLE_BACKEND_ASKS.md` §1.2.
 */
export async function updateVendorOrder(
  vendorId: string | number,
  orderId: string,
  update: { deliveryStatus?: DeliveryStatus; paymentStatus?: PaymentStatus },
): Promise<void> {
  if (!isLiveApi()) {
    await demoDelay()
    // Demo writes persist. A no-op here would tell the same lie a failed live write tells:
    // a success toast over an unchanged record.
    const patch: Record<string, unknown> = {}
    if (update.deliveryStatus) patch.order_status = update.deliveryStatus
    if (update.paymentStatus) patch.payment_status = update.paymentStatus
    if (!updateDemoOrder(orderId, patch)) throw new Error('No such order.')
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
    if (!updateDemoOrder(orderId, { order_status: 'CANCELLED' })) throw new Error('No such order.')
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
