import type { SubscriptionCheckoutCallback, SubscriptionCheckoutConfig } from '@/shared/payments/razorpay-checkout'

/** Proposed app view models. The backend has not published these billing fields or writes. */
export type BillingAction = 'setup_autopay' | 'pay_first_fee' | 'cancel'
export type BillingSource = 'mock' | 'demo' | 'preview' | 'backend' | 'local_test'

export interface VendorBillingStatus {
  vendorId: string
  source: BillingSource
  serverTime: string
  revision: number
  plan: { code: string; name: string; amountMinor: number; currency: 'INR'; interval: 'month' }
  setupPendingReason: 'onboarding' | 'approval' | 'both' | null
  trial: { status: 'not_started' | 'active' | 'ended' | 'ineligible'; endsAt: string | null; daysRemaining: number | null }
  authorisation: { status: 'not_configured' | 'pending' | 'confirmed' | 'failed' | 'revoked' }
  membership: { paymentStatus: 'none' | 'pending' | 'confirmed' | 'failed'; paidThrough: string | null; nextChargeAt: string | null }
  cancellation: { status: 'requested' | 'scheduled' | 'confirmed' | 'failed'; requestedAt: string | null; effectiveAt: string | null } | null
  refund: { status: 'owed' | 'pending' | 'completed' | 'failed'; amountMinor: number } | null
  notice: string | null
  accessStatus: 'TRIAL' | 'TRIAL_ENDED' | 'PAID' | 'PAYMENT_REQUIRED' | 'SETUP_INCOMPLETE'
  capabilities: string[]
  storeVisible: boolean
  availableActions: BillingAction[]
  /** Local Test helper only: which facts Razorpay Test records confirmed; everything else is simulated. */
  providerVerified?: { authorisation: boolean; payment: boolean; coverage?: boolean; cancellation?: boolean }
  /** Simulated sources only: the renewal outcomes this snapshot can explicitly advance to. */
  simulatedRenewalSteps?: SimulatedRenewalStep[]
}

/** Explicit simulated cancellation/refund steps. Checkout callbacks and provider states never advance them. */
export type SimulatedCancellationStep = 'cancellation_confirmed' | 'cancellation_failed' | 'renewal_debit_collected' | 'refund_started' | 'refund_completed' | 'refund_failed'

/** Explicit simulated renewal outcomes at the paid-through boundary. They never compute a new period. */
export type SimulatedRenewalStep = 'renewal_due' | 'renewal_failed' | 'renewal_retry_confirmed'

export interface BillingCheckoutAttempt {
  attemptId: string
  vendorId: string
  action: 'setup_autopay' | 'pay_first_fee'
  mode: 'simulated' | 'provider'
  /** Present only for an inspected Razorpay Test Mode subscription. */
  config: SubscriptionCheckoutConfig | null
  expected: { amountMinor: number; currency: 'INR'; chargeAt: string | null; authorisationAmountMinor: number | null }
  expiresAt: string
}

export interface VendorBillingService {
  getStatus: (vendorId: string) => Promise<VendorBillingStatus>
  prepareCheckout: (vendorId: string, action: 'setup_autopay' | 'pay_first_fee', idempotencyKey: string) => Promise<BillingCheckoutAttempt>
  /** A null callback is an explicitly simulated outcome, never a real provider result. */
  submitCheckout: (attempt: BillingCheckoutAttempt, callback: SubscriptionCheckoutCallback | null) => Promise<VendorBillingStatus>
  requestCancellation: (vendorId: string, idempotencyKey: string) => Promise<VendorBillingStatus>
  reconcileSimulatedCheckout?: (vendorId: string, outcome?: 'confirmed' | 'failed') => Promise<VendorBillingStatus>
  simulateCancellationProgress?: (vendorId: string, step: SimulatedCancellationStep) => Promise<VendorBillingStatus>
  simulateRenewalProgress?: (vendorId: string, step: SimulatedRenewalStep) => Promise<VendorBillingStatus>
}
