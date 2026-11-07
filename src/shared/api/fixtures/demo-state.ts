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
  DEMO_VENDOR_SUBSCRIPTIONS,
  DEMO_VENDOR_SIZES,
  DEMO_VENDOR_PROFILE,
} from './vendor-dashboard-seed'

type Row = Record<string, unknown>

type DemoBillingPhase = 'trial_active' | 'setup_pending' | 'setup_confirmed' | 'setup_failed'
  | 'cancel_requested' | 'cancel_confirmed' | 'cancel_failed' | 'replacement_prepared'

type DemoState = {
  orders: Row[]
  subscriptions: Row[]
  sizes: Row[]
  profile: Row
  /** Set to make the next demo read reject, so error handling is demonstrable. */
  failNextRead: boolean
  billingPhases: Map<string, DemoBillingPhase>
  billingCancelRequestedAt: Map<string, string>
  billingRevisions: Map<string, number>
  trialEndsAt: string
}

function seed(): DemoState {
  return {
    orders: DEMO_VENDOR_ORDERS.map((row) => ({ ...row })),
    subscriptions: DEMO_VENDOR_SUBSCRIPTIONS.map((row) => ({ ...row })),
    sizes: DEMO_VENDOR_SIZES.map((row) => ({ ...row })),
    profile: { ...DEMO_VENDOR_PROFILE },
    failNextRead: false,
    billingPhases: new Map(),
    billingCancelRequestedAt: new Map(),
    billingRevisions: new Map(),
    trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

let state = seed()

/** Simulated billing lives with the demo context, never in auth or production account state. */
export function demoBillingContextFields(vendorId: string) {
  const phase = state.billingPhases.get(vendorId) ?? 'trial_active'
  const pending = phase === 'setup_pending'
  const failed = phase === 'setup_failed'
  const cancelConfirmed = phase === 'cancel_confirmed'
  // A prepared replacement is the current agreement; the old agreement's cancellation no longer describes it.
  const revoked = cancelConfirmed || phase === 'replacement_prepared'
  // A requested or failed cancellation leaves the confirmed agreement collecting until confirmation.
  const collecting = phase === 'setup_confirmed' || phase === 'cancel_requested' || phase === 'cancel_failed'
  const requestedAt = state.billingCancelRequestedAt.get(vendorId) ?? null
  return {
    subscription: {
      tier: 'PLATFORM_MONTHLY', plan_name: 'MithraDirect monthly', monthly_price: 399,
      trial_days: 14,
      trial_ends_at: state.trialEndsAt,
      billing: {
        revision: state.billingRevisions.get(vendorId) ?? 1,
        trial_status: 'active', trial_days_remaining: 10,
        autopay_status: pending ? 'pending' : collecting ? 'confirmed' : failed ? 'failed' : revoked ? 'revoked' : 'not_configured',
        payment_status: 'none', paid_through: null,
        next_charge_at: pending || collecting ? state.trialEndsAt : null,
        access_status: 'TRIAL', store_visible: true,
        // Only a confirmed agreement has simulated collection to cancel.
        available_actions: phase === 'setup_confirmed' ? ['cancel'] : pending || collecting ? [] : ['setup_autopay'],
        cancellation: phase === 'cancel_requested' || phase === 'cancel_failed' || cancelConfirmed ? {
          status: phase === 'cancel_requested' ? 'requested' : cancelConfirmed ? 'confirmed' : 'failed',
          requested_at: requestedAt,
          effective_at: cancelConfirmed ? requestedAt : null,
        } : null,
        refund: null,
        notice: pending ? 'Simulated AutoPay confirmation is pending. Your original trial expiry still applies.'
          : failed ? 'Simulated AutoPay setup failed. Trial access keeps its original expiry.'
            : phase === 'cancel_failed' ? 'Simulated cancellation is not confirmed, so AutoPay may still collect the first fee. Refresh billing status before trying again.' : null,
      },
    },
  }
}

export function setDemoBillingPhase(vendorId: string, phase: DemoBillingPhase): void {
  if (phase === 'cancel_requested') state.billingCancelRequestedAt.set(vendorId, new Date().toISOString())
  state.billingPhases.set(vendorId, phase)
  state.billingRevisions.set(vendorId, (state.billingRevisions.get(vendorId) ?? 1) + 1)
}

export function resetDemoState() {
  state = seed()
}

export function demoOrders(): Row[] {
  return state.orders
}

export function demoSubscriptions(): Row[] {
  return state.subscriptions
}

export function demoSizes(): Row[] {
  return state.sizes
}

export function demoProfile(): Row {
  return state.profile
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
