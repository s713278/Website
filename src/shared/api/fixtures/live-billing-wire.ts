/**
 * Live API billing responses for tests, in the wire shape measured on dev (the `data` of each
 * envelope). Every ID is fake and no field comes from a real vendor.
 */

export const liveMonthlyPlan = {
  plan_id: 2,
  plan_code: 'MITHRA_SOCIAL_STARTER_MONTHLY',
  plan_name: 'Mithra Social Starter',
  description: 'Everything small vendors need to sell online',
  features: ['STOREFRONT', 'ORDERS', 'CUSTOMERS', 'CATALOG', 'NOTIFICATIONS'],
  limits: { max_products: 100, max_images_per_product: 10, max_staff_users: 2 },
  billing_cycle: 'MONTHLY',
  currency: 'INR',
  // Rupees on the live API, although OpenAPI documents paise.
  sale_price: 299,
  list_price: 599,
  external_plan_id: 'plan_FakeMonthly0001',
}

/** `GET /v1/subscription-plans`: dev lists the monthly plan only. */
export const livePlans = [liveMonthlyPlan]

/** `GET /v1/vendors/{vendor_id}/subscription` for a shop in its free days with no AutoPay. */
export function liveTrialSubscription(overrides: Record<string, unknown> = {}) {
  return {
    subscription_id: 9001,
    vendor_id: 9001,
    plan_code: 'SOCIAL_STARTER_TRIAL',
    plan_name: 'Social Starter Trial',
    billing_cycle: 'MONTHLY',
    currency: 'INR',
    sale_price: 0,
    status: 'TRIAL_ACTIVE',
    trial_started_at: '2026-09-28T10:04:16.169028Z',
    trial_ends_at: '2026-10-12T10:04:16.169028Z',
    razorpay_subscription_id: null,
    razorpay_status: null,
    current_period_start: null,
    current_period_end: null,
    next_billing_at: null,
    cancel_at_period_end: false,
    created_at: '2026-09-28T10:04:16.169028Z',
    updated_at: '2026-09-28T10:04:16.169028Z',
    ...overrides,
  }
}

/** The paid plan's fields, which the subscription carries once a Razorpay subscription exists. */
const paidPlanFields = {
  plan_code: 'MITHRA_SOCIAL_STARTER_MONTHLY',
  plan_name: 'Mithra Social Starter',
  sale_price: 299,
}

/**
 * Trial AutoPay approved in Checkout, as dev returns it today (gap C): PAYMENT_PENDING with the paid
 * plan and no `next_billing_at`, while the trial dates stay correct.
 */
export function liveTrialAutoPaySubscription(overrides: Record<string, unknown> = {}) {
  return liveTrialSubscription({
    ...paidPlanFields,
    status: 'PAYMENT_PENDING',
    razorpay_subscription_id: 'sub_FakeAutoPay0001',
    razorpay_status: 'authenticated',
    updated_at: '2026-09-28T10:09:41.52841Z',
    ...overrides,
  })
}

/**
 * Razorpay has activated the subscription but not yet captured the ₹299 (gap B): ACTIVE with no paid
 * period and no next charge.
 */
export function liveActivatedSubscription(overrides: Record<string, unknown> = {}) {
  return liveTrialAutoPaySubscription({
    status: 'ACTIVE',
    razorpay_status: 'active',
    updated_at: '2026-10-13T10:04:20.4113Z',
    ...overrides,
  })
}

/**
 * Paid: Razorpay captured the ₹299. The period comes from the invoice and ends at IST midnight, and
 * `next_billing_at` is the period end.
 */
export function livePaidSubscription(overrides: Record<string, unknown> = {}) {
  return liveActivatedSubscription({
    current_period_start: '2026-10-13T10:10:02Z',
    current_period_end: '2026-11-12T18:30Z',
    next_billing_at: '2026-11-12T18:30Z',
    updated_at: '2026-10-13T10:10:05.23761Z',
    ...overrides,
  })
}

/**
 * The plan stopped during a paid period, as dev returns it today (gap F): still ACTIVE with
 * `cancel_at_period_end`, and `next_billing_at` not cleared.
 */
export function liveStoppedSubscription(overrides: Record<string, unknown> = {}) {
  return livePaidSubscription({
    cancel_at_period_end: true,
    updated_at: '2026-10-14T08:21:47.90412Z',
    ...overrides,
  })
}

/**
 * A stopped plan cancelled at Razorpay during the paid period, as dev returns it today (gap H): the
 * webhook sets CANCELLED at once, the paid period and `next_billing_at` (gap F) stay. The
 * `razorpay_status` was not recorded; `cancelled` is inferred, and CANCELLED alone decides the row.
 */
export function liveCancelledPaidSubscription(overrides: Record<string, unknown> = {}) {
  return liveStoppedSubscription({
    status: 'CANCELLED',
    razorpay_status: 'cancelled',
    cancelled_at: '2026-10-20T07:42:05.11873Z',
    updated_at: '2026-10-20T07:42:05.11873Z',
    ...overrides,
  })
}
