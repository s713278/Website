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
  sale_price: 399,
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
  sale_price: 399,
}

/**
 * Pay ₹399 with Razorpay during free days, as dev returns it today (gaps K and C): Checkout approved
 * an AutoPay-only subscription, read as PAYMENT_PENDING with the paid plan and no `next_billing_at`,
 * while the trial dates stay correct.
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
 * Pay ₹399 with Razorpay during free days, in the read gap K requests (not built on dev): the trial
 * status and plan stay until the ₹399 is captured, with a Razorpay subscription `created` until
 * Checkout pays and approves AutoPay.
 */
export function liveEarlyFeeSubscription(overrides: Record<string, unknown> = {}) {
  return liveTrialSubscription({
    razorpay_subscription_id: 'sub_FakeEarlyFee0001',
    razorpay_status: 'created',
    updated_at: '2026-09-30T09:12:40.20931Z',
    ...overrides,
  })
}

/**
 * The early first fee captured, in the read gap K requests (not built on dev): ACTIVE, the paid month
 * running from T to one month later, and the next ₹399 at its end.
 */
export function liveEarlyFeePaidSubscription(overrides: Record<string, unknown> = {}) {
  return liveEarlyFeeSubscription({
    ...paidPlanFields,
    status: 'ACTIVE',
    razorpay_status: 'active',
    current_period_start: '2026-10-12T10:04:16.169028Z',
    current_period_end: '2026-11-12T10:04:16.169028Z',
    next_billing_at: '2026-11-12T10:04:16.169028Z',
    updated_at: '2026-09-30T09:13:02.71845Z',
    ...overrides,
  })
}

/**
 * Razorpay has activated the subscription but not yet captured the ₹399 (gap B): ACTIVE with no paid
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
 * Paid: Razorpay captured the ₹399. The period comes from the invoice and ends at IST midnight, and
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

/**
 * Pay ₹399 after the trial, as dev returns it today (gap I): PAYMENT_PENDING with the paid plan and
 * a Razorpay subscription still `created`, no paid period and no next charge.
 */
export function livePayingAfterTrialSubscription(overrides: Record<string, unknown> = {}) {
  return liveTrialSubscription({
    ...paidPlanFields,
    status: 'PAYMENT_PENDING',
    razorpay_subscription_id: 'sub_FakePayNow0001',
    razorpay_status: 'created',
    updated_at: '2026-10-12T10:20:03.61527Z',
    ...overrides,
  })
}

/**
 * Renewal failed after every retry: HALTED, keeping the last paid period. Not yet seen on dev; this
 * is the backend brief's expected shape.
 */
export function liveHaltedSubscription(overrides: Record<string, unknown> = {}) {
  return livePaidSubscription({
    status: 'HALTED',
    razorpay_status: 'cancelled',
    next_billing_at: null,
    updated_at: '2026-11-15T18:30:12.40731Z',
    ...overrides,
  })
}

/**
 * `POST /v1/vendors/{vendor_id}/subscription` during the free days: the Razorpay subscription to open
 * in Checkout. A repeat while pending returns the same one. `checkout_url` is not used.
 */
export function liveSubscribeResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 'PAYMENT_PENDING',
    razorpay_key_id: 'rzp_test_FakeKey0001',
    razorpay_subscription_id: 'sub_FakeAutoPay0001',
    checkout_url: 'https://rzp.io/rzp/FakeCheckout0001',
    ...overrides,
  }
}

/**
 * One `GET …/subscription/history` entry. Dev sends no amount, and since 29 September it leaves null
 * fields out, so an event without a payment has no `external_payment_id` key.
 */
export function liveHistoryEvent(eventType: string, overrides: Record<string, unknown> = {}) {
  return {
    event_type: eventType,
    new_status: 'PAYMENT_PENDING',
    external_subscription_id: 'sub_FakeAutoPay0001',
    event_at: '2026-09-28T10:09:41.52841Z',
    previous_status: 'PAYMENT_PENDING',
    ...overrides,
  }
}

/**
 * `GET …/subscription/history` for the paid shop that then stopped its plan, newest first as dev
 * sends it. It keeps dev's duplicate rows (gap G): a repeated `confirm` and a repeated cancel each
 * wrote their event twice.
 */
export function liveStoppedHistory() {
  return [
    liveHistoryEvent('CANCELLATION_REQUESTED', { previous_status: 'ACTIVE', new_status: 'ACTIVE', event_at: '2026-10-14T08:22:30.1174Z' }),
    liveHistoryEvent('CANCELLATION_REQUESTED', { previous_status: 'ACTIVE', new_status: 'ACTIVE', event_at: '2026-10-14T08:21:47.90412Z' }),
    liveHistoryEvent('SUBSCRIPTION_CHARGED', { previous_status: 'ACTIVE', new_status: 'ACTIVE', external_payment_id: 'pay_FakeCharge0001', event_at: '2026-10-13T10:10:02.31872Z' }),
    liveHistoryEvent('SUBSCRIPTION_ACTIVATED', { previous_status: 'PAYMENT_PENDING', new_status: 'ACTIVE', event_at: '2026-10-13T10:04:20.4113Z' }),
    liveHistoryEvent('PAYMENT_AUTHORIZED', { external_payment_id: 'pay_FakeMandate0001', event_at: '2026-09-28T10:09:58.01263Z' }),
    liveHistoryEvent('PAYMENT_AUTHORIZED', { external_payment_id: 'pay_FakeMandate0001', event_at: '2026-09-28T10:09:52.77405Z' }),
    liveHistoryEvent('SUBSCRIPTION_AUTHENTICATED', { event_at: '2026-09-28T10:09:41.52841Z' }),
    liveHistoryEvent('CHECKOUT_CREATED', { previous_status: 'TRIAL_ACTIVE', event_at: '2026-09-28T10:08:03.64419Z' }),
  ]
}
