import { nextDeliveryStatus } from '@/modules/vendor/lib/order-actions'
import type {
  DeliveryStatus,
  VendorOrderDetail,
  VendorOrderPage,
} from '@/modules/vendor/types/dashboard'
import { apiGet, apiPatch, apiPost } from '../client'
import { isApiError } from '../errors'
import { findDemoOrder, updateDemoOrder } from '../fixtures/demo-state'
import { demoVendorOrderDetail, demoVendorOrdersPage } from '../fixtures/vendor-dashboard'
import {
  mapBulkStatusResult,
  mapVendorOrderDetail,
  mapVendorOrderPage,
  toDeliveryStatus,
} from '../mappers/vendor-dashboard'
import { isLiveApi } from '../mode'
import { demoDelay } from './demo-delay'

/** The page size `GET /v1/vendors/{id}/orders/` serves; the list pages through it. */
const PAGE_SIZE = 20

export type VendorOrderQuery = {
  page?: number
  status?: DeliveryStatus | null
  startDate?: string | null
  endDate?: string | null
  /** Overridden only by the delivery-window subtotal, which walks bigger pages. */
  size?: number
}

/**
 * One page of orders.
 *
 * Filtering and paging are the server's job: the endpoint takes `order_status`,
 * `start_date`, `end_date`, `page` and `size`, so a filtered view costs one request
 * rather than fetching everything and narrowing it in the browser.
 *
 * Both dates filter on `delivery_date`. It is the only date the contract has — no order read
 * carries a creation timestamp — so no caller may present this as a booking or sales window.
 */
export async function listVendorOrders(
  vendorId: string | number,
  query: VendorOrderQuery = {},
): Promise<VendorOrderPage> {
  const page = query.page ?? 0
  const size = query.size ?? PAGE_SIZE

  if (!isLiveApi()) {
    await demoDelay()
    return mapVendorOrderPage(
      demoVendorOrdersPage(page, size, {
        status: query.status ?? undefined,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
    )
  }

  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (query.status) params.set('order_status', query.status)
  if (query.startDate) params.set('start_date', query.startDate)
  if (query.endDate) params.set('end_date', query.endDate)

  return mapVendorOrderPage(await apiGet(`/v1/vendors/${vendorId}/orders/?${params}`))
}

/**
 * One order with its lines, or `null` when there is no such order.
 *
 * The list read carries headers only, so line items need this second endpoint — which is
 * why order detail is its own route rather than an inline expand.
 *
 * A 404 comes back as `null` rather than as a thrown error, so that "no such order" and
 * "the request failed" stay two different facts all the way to the screen. They need
 * different words: one is final, the other is worth retrying.
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

  try {
    return mapVendorOrderDetail(await apiGet(`/v1/vendors/${vendorId}/orders/${orderId}/items`))
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null
    throw error
  }
}

/**
 * The store refused to move an order, through a response that reported success.
 *
 * Its own type because the caller has to tell it apart from a transport failure: a refusal
 * means the order is not where the vendor thinks it is, and reloading answers it. The
 * backend's `reason` is carried for logs and is **deliberately not the message** — it is
 * the same generic sentence for a wrong next status, an order that is not yours, and an
 * order already in the target state, so showing it would tell a vendor to check an input
 * they never typed. `forwardRefusalMessage` in `lib/order-actions.ts` owns what is shown.
 */
export class OrderTransitionRefusedError extends Error {
  readonly orderId: string
  readonly requestedStatus: DeliveryStatus
  /** For logging only. Never render this. */
  readonly backendReason: string | null

  constructor(orderId: string, requestedStatus: DeliveryStatus, backendReason: string | null) {
    super(`The store refused to move order ${orderId} to ${requestedStatus}.`)
    this.name = 'OrderTransitionRefusedError'
    this.orderId = orderId
    this.requestedStatus = requestedStatus
    this.backendReason = backendReason
  }
}

export function isOrderTransitionRefused(error: unknown): error is OrderTransitionRefusedError {
  return error instanceof OrderTransitionRefusedError
}

/**
 * Move an order one step along the delivery chain.
 *
 * Two measured facts shape this whole function.
 *
 * **The only working route is the bulk one.** `PATCH /v1/vendors/{v}/orders/{id}` returns 417
 * for every body including `{}` — Jackson cannot instantiate its request DTO, so it fails
 * before the order id is looked up. `POST …/orders/bulk-status-update` works, one id at a
 * time, one hop at a time.
 *
 * **A refusal arrives as HTTP 200.** An illegal transition is `success: true`, `status: 200`,
 * `data.success_count: 0`, with the order under `failed_orders`. Checking the status code
 * alone reports a silent no-op as a success — which is what the previous advance button did.
 * So the response is inspected, and anything short of a counted success throws.
 *
 * There is no equivalent for marking an order paid: no route can set `payment_status`. See
 * `docs/VENDOR_CONSOLE_BACKEND_ASKS.md` §1.2 and §2.3.
 */
export async function advanceVendorOrder(
  vendorId: string | number,
  orderId: string,
  next: DeliveryStatus,
): Promise<void> {
  if (!isLiveApi()) {
    await demoDelay()
    const order = findDemoOrder(orderId)
    if (!order) throw new Error('No such order.')
    // Demo enforces the same one-hop rule live enforces. A demo that accepts a jump live
    // refuses would hide the defect this ticket exists to fix.
    const allowed = nextDeliveryStatus(toDeliveryStatus(order.order_status))
    if (allowed !== next) throw new OrderTransitionRefusedError(orderId, next, null)
    updateDemoOrder(orderId, { order_status: next })
    return
  }

  // The backend types `order_ids` as numbers; a non-numeric id is passed through rather than
  // silently becoming `NaN`, so a malformed id fails visibly at the request instead.
  const numericId = Number(orderId)
  const result = mapBulkStatusResult(
    await apiPost(`/v1/vendors/${vendorId}/orders/bulk-status-update`, {
      order_ids: [Number.isFinite(numericId) ? numericId : orderId],
      new_status: next,
    }),
  )

  if (result.successCount < 1) {
    const failure = result.failed.find((entry) => entry.orderId === orderId) ?? result.failed[0]
    throw new OrderTransitionRefusedError(orderId, next, failure?.reason ?? null)
  }
}

/**
 * Cancel an order.
 *
 * Its own endpoint, and note the body key: `cancelReason` in camelCase, where the update
 * and bulk endpoints both use `cancel_reason`. The inconsistency is the backend's.
 *
 * This is never routed through `bulk-status-update`. `CANCELLED` is in that endpoint's
 * declared enum but returns 417 with a rolled-back transaction, while this route works from
 * every state tested including `SHIPPED`.
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
  advance: advanceVendorOrder,
  cancel: cancelVendorOrder,
}
