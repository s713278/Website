import type { BillingIntent, VendorBillingService, VendorBillingStatus } from './vendor-billing.service'

export type BillingPreviewScenario = 'trial' | 'last_day' | 'expired' | 'setup' | 'authorised_trial' | 'paid'

export interface BillingPreviewConfig {
  keyId: string
  immediateSubscriptionId: string
  futureSubscriptionId: string
}

/** Isolated fixtures. Never read vendor context, write auth state, or infer entitlement from Checkout. */
export function createVendorBillingPreviewService(
  config: BillingPreviewConfig,
  scenario: BillingPreviewScenario,
): VendorBillingService {
  if (!import.meta.env.DEV) throw new Error('The billing preview is available only in development.')
  const isTrial = ['trial', 'last_day', 'authorised_trial'].includes(scenario)
  const daysRemaining = scenario === 'last_day' ? 1 : scenario === 'authorised_trial' ? 14 : 3
  let status: VendorBillingStatus = {
    storeId: 'development-store',
    source: 'development',
    plan: { name: 'MithraDirect monthly platform membership', amountMinor: 29900, currency: 'INR' },
    trial: {
      status: isTrial ? 'active' : scenario === 'setup' ? 'not_started' : scenario === 'paid' ? 'converted' : 'ended',
      endsAt: isTrial ? new Date(Date.now() + daysRemaining * 86400000).toISOString() : null,
      daysRemaining: isTrial ? daysRemaining : null,
      reminder: scenario === 'trial' ? 'three_days' : scenario === 'last_day' ? 'last_day' : null,
    },
    authorisation: ['authorised_trial', 'paid'].includes(scenario) ? 'confirmed' : 'not_configured',
    payment: scenario === 'paid' ? 'confirmed' : 'none',
    accessStatus: isTrial ? 'TRIAL' : scenario === 'setup' ? 'SETUP_REQUIRED' : scenario === 'paid' ? 'PAID' : 'PAYMENT_REQUIRED',
    canAccessPlatform: isTrial || scenario === 'paid',
    paidThrough: scenario === 'paid' ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
    availableActions: scenario === 'setup'
      ? ['trial_authorisation']
      : scenario === 'paid' ? []
        : scenario === 'authorised_trial' ? ['continue_trial']
          : isTrial ? ['continue_trial', 'paid_membership'] : ['paid_membership'],
    earlyConversionRequiresBackend: scenario === 'authorised_trial',
  }
  const submittedSubscriptions = new Set<string>()
  const attempts = new Map<string, { intent: BillingIntent; subscriptionId: string }>()

  return {
    async getStatus() {
      return structuredClone(status)
    },
    async prepareCheckout(intent) {
      if (!status.availableActions.includes(intent)) throw new Error('This action is not available for the displayed billing status.')
      if (!/^rzp_test_[A-Za-z0-9]+$/.test(config.keyId)) throw new Error('Enter a Razorpay Test Mode public key ID (rzp_test_…). Never enter the key secret.')
      const subscriptionId = intent === 'trial_authorisation' ? config.futureSubscriptionId : config.immediateSubscriptionId
      if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) throw new Error(`Provide a fresh ${intent === 'trial_authorisation' ? 'future-start' : 'immediate-start'} Test Mode subscription ID.`)
      if (config.futureSubscriptionId && config.futureSubscriptionId === config.immediateSubscriptionId) {
        throw new Error('Use different subscriptions for immediate payment and future-start authorisation.')
      }
      if (submittedSubscriptions.has(subscriptionId)) throw new Error('This subscription already returned a callback. Confirm its status server-side before another attempt.')
      const attemptId = crypto.randomUUID()
      attempts.set(attemptId, { intent, subscriptionId })
      return {
        attemptId,
        intent,
        config: { keyId: config.keyId, subscriptionId, name: 'MithraDirect', description: 'Vendor platform membership · Test Mode' },
      }
    },
    async submitCheckout(attempt, callback) {
      const expected = attempts.get(attempt.attemptId)
      if (!expected || expected.intent !== attempt.intent || expected.subscriptionId !== callback.razorpay_subscription_id
        || !callback.razorpay_payment_id || !callback.razorpay_signature) {
        throw new Error('Checkout returned incomplete or mismatched details. Backend verification is required; access has not changed.')
      }
      submittedSubscriptions.add(expected.subscriptionId)
      // This is deliberately NOT verification. No secret or HMAC runs in the browser.
      // In particular, preserve the original trial expiry and access while conversion is unconfirmed.
      status = {
        ...status,
        authorisation: status.authorisation === 'confirmed' ? 'confirmed' : 'pending',
        payment: expected.intent === 'paid_membership' ? 'pending' : status.payment,
        availableActions: status.availableActions.filter((action) => action === 'continue_trial'),
      }
      return structuredClone(status)
    },
  }
}
