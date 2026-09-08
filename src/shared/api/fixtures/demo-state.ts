/**
 * Mutable demo state for the vendor console.
 *
 * Demo writes used to be no-ops: a service in demo mode awaited a delay and returned. A
 * vendor could edit a price, see a success toast, and find the old price on the next read —
 * which is the same lie a failed live write tells, and exactly what the console is being
 * rebuilt to stop doing. This module gives demo mode somewhere to actually write.
 *
 * Three deliberate constraints:
 *
 * - **Services only.** Nothing outside `src/shared/api` may import this. The demo/live
 *   branch lives in the service layer, and a component reaching in here would put mode
 *   awareness back into the UI — the drift that let demo look perfect while live was broken.
 * - **Wire shape, not view models.** State is held exactly as the backend sends it, so demo
 *   and live pass through the same mappers. A fixture that stops matching the mapper fails a
 *   test instead of quietly diverging.
 * - **Memory only.** Reloading resets everything, which makes a walkthrough repeatable
 *   without a reset control and keeps a demo edit from outliving the session that made it.
 */

import {
  DEMO_VENDOR_ORDERS,
  DEMO_VENDOR_SIZES,
  DEMO_VENDOR_PROFILE,
} from './vendor-dashboard-seed'

type Row = Record<string, unknown>

/** The five states `deriveStoreState` can produce, as the two fields it derives them from. */
export type DemoStoreStateKey = 'SETTING_UP' | 'UNDER_REVIEW' | 'OPEN' | 'REJECTED' | 'SUSPENDED'

export type DemoStoreStateOverride = {
  vendorStatus: string
  approvalStatus: string
}

/**
 * The switcher writes these two fields and lets `deriveStoreState` run, rather than
 * setting a `StoreState` directly. Setting the outcome would make the switcher a second
 * source of truth, free to display a combination the real derivation could never produce.
 */
const STORE_STATES: Record<DemoStoreStateKey, DemoStoreStateOverride> = {
  SETTING_UP: { vendorStatus: 'INACTIVE', approvalStatus: 'PENDING' },
  UNDER_REVIEW: { vendorStatus: 'ACTIVE', approvalStatus: 'PENDING' },
  OPEN: { vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED' },
  REJECTED: { vendorStatus: 'ACTIVE', approvalStatus: 'REJECTED' },
  SUSPENDED: { vendorStatus: 'SUSPENDED', approvalStatus: 'APPROVED' },
}

export const DEMO_STORE_STATE_KEYS = Object.keys(STORE_STATES) as DemoStoreStateKey[]

/** The two fields a given key derives from. Pure, so the switcher can be tested directly. */
export function storeStateFieldsFor(key: DemoStoreStateKey): DemoStoreStateOverride {
  return STORE_STATES[key]
}

type DemoState = {
  orders: Row[]
  sizes: Row[]
  profile: Row
  storeState: DemoStoreStateKey
  /** Set to make the next demo read reject, so error handling is demonstrable. */
  failNextRead: boolean
}

function seed(): DemoState {
  return {
    orders: DEMO_VENDOR_ORDERS.map((row) => ({ ...row })),
    sizes: DEMO_VENDOR_SIZES.map((row) => ({ ...row })),
    profile: { ...DEMO_VENDOR_PROFILE },
    storeState: 'OPEN',
    failNextRead: false,
  }
}

let state = seed()

export function resetDemoState() {
  state = seed()
}

export function demoOrders(): Row[] {
  return state.orders
}

export function demoSizes(): Row[] {
  return state.sizes
}

export function demoProfile(): Row {
  return state.profile
}

export function demoStoreStateOverride(): DemoStoreStateOverride {
  return STORE_STATES[state.storeState]
}

export function demoStoreStateKey(): DemoStoreStateKey {
  return state.storeState
}

export function setDemoStoreState(key: DemoStoreStateKey) {
  state.storeState = key
}

/**
 * Throws once if a failure has been armed, then disarms.
 *
 * A demo that only ever succeeds cannot show what recovery looks like, and the walkthrough
 * is expected to demonstrate one failed request.
 */
export function consumeDemoFailure() {
  if (!state.failNextRead) return
  state.failNextRead = false
  throw new Error('Demo failure: this request was set to fail.')
}

export function armDemoFailure() {
  state.failNextRead = true
}

/** One demo order in wire shape, or `null`. Services read it to enforce the same rules live does. */
export function findDemoOrder(orderId: string): Row | null {
  return state.orders.find((order) => String(order.order_id) === orderId) ?? null
}

/** Applies a partial update to one order, matched on `order_id`. Returns false if absent. */
export function updateDemoOrder(orderId: string, patch: Row): boolean {
  const row = state.orders.find((order) => String(order.order_id) === orderId)
  if (!row) return false
  Object.assign(row, patch)
  return true
}

/** Applies a partial update to one size, matched on `price_id` — what a price edit writes to. */
export function updateDemoSizeByPriceId(priceId: string, patch: Row): boolean {
  const row = state.sizes.find((size) => String(size.price_id) === priceId)
  if (!row) return false
  Object.assign(row, patch)
  return true
}

/** Applies a partial update to one size, matched on `sku_id`. */
export function updateDemoSizeBySkuId(skuId: string, patch: Row): boolean {
  const row = state.sizes.find((size) => String(size.sku_id) === skuId)
  if (!row) return false
  Object.assign(row, patch)
  return true
}

/**
 * Merges into the demo profile the way the live `PUT` merges: absent keys are left alone
 * and an explicit `null` is ignored. Demo must not offer a clear that live cannot perform.
 */
export function updateDemoProfile(patch: Row) {
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue
    state.profile[key] = value
  }
}
