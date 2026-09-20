import type { SubscriptionCheckoutCallback, SubscriptionCheckoutConfig } from '@/shared/payments/razorpay-checkout'

/** App view models, not an implemented Spring Boot HTTP contract. */
export type BillingIntent = 'paid_membership' | 'trial_authorisation'

export interface VendorBillingStatus {
  storeId: string
  source: 'development' | 'backend'
  plan: { name: string; amountMinor: number; currency: 'INR' }
  trial: {
    status: 'not_started' | 'active' | 'ended' | 'converted'
    endsAt: string | null
    daysRemaining: number | null
    reminder: 'three_days' | 'last_day' | null
  }
  authorisation: 'not_configured' | 'pending' | 'confirmed'
  payment: 'none' | 'pending' | 'confirmed'
  accessStatus: 'SETUP_REQUIRED' | 'TRIAL' | 'PAYMENT_REQUIRED' | 'PAID'
  canAccessPlatform: boolean
  paidThrough: string | null
  availableActions: Array<BillingIntent | 'continue_trial'>
  earlyConversionRequiresBackend: boolean
}

export interface BillingCheckoutAttempt {
  attemptId: string
  intent: BillingIntent
  config: SubscriptionCheckoutConfig
}

export interface VendorBillingService {
  getStatus: () => Promise<VendorBillingStatus>
  prepareCheckout: (intent: BillingIntent) => Promise<BillingCheckoutAttempt>
  submitCheckout: (attempt: BillingCheckoutAttempt, callback: SubscriptionCheckoutCallback) => Promise<VendorBillingStatus>
}
