/**
 * Which orders this vendor has marked paid, kept in this browser.
 *
 * MithraDirect never handles the money, so payment status is not a fact the system can
 * observe — it is the vendor's own note that they were paid, and **no backend route will
 * store it**. `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md` carries the
 * probe evidence and the removal condition.
 *
 * Three constraints follow from that, and each is load-bearing:
 *
 * - **Keyed by vendor id.** Two vendor accounts sharing one phone must never see each
 *   other's records.
 * - **Never cleared automatically** — not on sign-out, not on a token refresh. This is the
 *   only copy of the record that exists anywhere; clearing it with the session would destroy
 *   a vendor's ledger every time they signed out. Only the browser's own site-data clearing
 *   removes it. Nothing here may be registered with `onExplicitSignOut`.
 * - **No pruning.** It stores order ids, so a few thousand orders is tens of kilobytes.
 *
 * Read by `vendor-orders.service.ts` alone. **No page or component may import it**: the
 * demo/live branch lives in the service layer, and a screen reaching in here would have to
 * know where the value is stored, which is the one thing the seam exists to hide. A test
 * asserting what happens to the stored value is not a screen, and may.
 */

export const PAID_ORDERS_STORAGE_KEY = 'md-vendor-paid-orders-v1'

/** Bumped only if the stored shape changes. An unrecognised version reads as empty. */
const PAID_ORDERS_VERSION = 1

type PaidOrdersByVendor = Record<string, string[]>

function isOrderIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/**
 * A stored value that is not what this module wrote reads as "nothing marked paid".
 *
 * Never a throw: the vendor would be looking at a broken orders screen because of a value
 * some other tab, some older build, or a corrupted profile left behind.
 */
function parse(raw: string): PaidOrdersByVendor {
  const value: unknown = JSON.parse(raw)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const file = value as { version?: unknown; vendors?: unknown }
  if (file.version !== PAID_ORDERS_VERSION) return {}
  if (file.vendors === null || typeof file.vendors !== 'object' || Array.isArray(file.vendors)) {
    return {}
  }

  const vendors: PaidOrdersByVendor = {}
  for (const [vendorId, orderIds] of Object.entries(file.vendors)) {
    if (isOrderIdList(orderIds)) vendors[vendorId] = orderIds
  }
  return vendors
}

function read(): PaidOrdersByVendor {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PAID_ORDERS_STORAGE_KEY)
    return raw === null ? {} : parse(raw)
  } catch {
    return {}
  }
}

/** Throws when the browser refuses the write. Callers decide whether that is worth saying. */
function write(vendors: PaidOrdersByVendor): void {
  if (typeof window === 'undefined') {
    throw new Error('This browser cannot save the payment record.')
  }
  window.localStorage.setItem(
    PAID_ORDERS_STORAGE_KEY,
    JSON.stringify({ version: PAID_ORDERS_VERSION, vendors }),
  )
}

/** The orders this vendor has marked paid on this device. Empty when nothing is stored. */
export function readPaidOrders(vendorId: string): ReadonlySet<string> {
  return new Set(read()[vendorId] ?? [])
}

/**
 * Add or remove one order from this vendor's record.
 *
 * Deliberately allowed to throw. A private-mode browser or a full quota means the record was
 * not kept, and a vendor told otherwise would trust a ledger that does not exist.
 */
export function recordPaidOrder(vendorId: string, orderId: string, paid: boolean): void {
  const vendors = read()
  const current = vendors[vendorId] ?? []
  // Nothing to write when the record already says this. Without the guard, unmarking an
  // order that was never marked would rewrite the file — and could throw on a browser that
  // refuses storage, over a change that was not being made.
  if (paid === current.includes(orderId)) return
  const next = paid ? [...current, orderId] : current.filter((id) => id !== orderId)
  write({ ...vendors, [vendorId]: next })
}

/**
 * Drop records for orders the backend now reports as paid itself.
 *
 * Best-effort, and the one write here that swallows a failure: it is triggered by a *read*,
 * so a browser that refuses it must still hand the screen its orders. The stale record is
 * harmless — a backend `PAID` outranks it on every read.
 */
export function forgetPaidOrders(vendorId: string, orderIds: readonly string[]): void {
  if (!orderIds.length) return
  const vendors = read()
  const current = vendors[vendorId]
  if (!current?.length) return
  const drop = new Set(orderIds)
  const next = current.filter((id) => !drop.has(id))
  if (next.length === current.length) return
  try {
    write({ ...vendors, [vendorId]: next })
  } catch {
    /* a read must not fail because its tidy-up could not be stored */
  }
}
