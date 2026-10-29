import type { SubscriptionCheckoutCallback } from '@/shared/payments/razorpay-checkout'
import { billingFixtureVendorId, createVendorBillingMockService, type BillingFixtureScenario } from './vendor-billing-fixture.service'
import type { BillingCheckoutAttempt, VendorBillingService } from './vendor-billing.service'

export type BillingPreviewScenario = BillingFixtureScenario

export interface BillingPreviewConfig {
  keyId: string
  immediateSubscriptionId: string
  futureSubscriptionId: string
  /** UTC/offset timestamp copied from an inspected Test Mode future-start subscription. */
  futureStartAt?: string
}

function testKey(keyId: string): void {
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId)) throw new Error('Enter a Razorpay Test Mode public key ID (rzp_test_…). Never enter the key secret.')
}

function testSubscription(subscriptionId: string, phase: string): void {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) throw new Error(`Provide a fresh ${phase} Test Mode subscription ID.`)
}

/** Isolated preview. A real Test callback remains unverified and can only show pending. */
export function createVendorBillingPreviewService(config: BillingPreviewConfig, scenario: BillingPreviewScenario): VendorBillingService {
  if (!import.meta.env.DEV) throw new Error('The billing preview is available only in development.')
  const fixture = createVendorBillingMockService(scenario, 'preview')
  const vendorId = billingFixtureVendorId(scenario)
  const providerAttempts = new Map<string, string>()
  const usedSubscriptions = new Set<string>()
  let lastAttemptWasProvider = false

  return {
    getStatus: fixture.getStatus,
    async prepareCheckout(selectedVendorId, action, idempotencyKey) {
      const attempt = await fixture.prepareCheckout(selectedVendorId, action, idempotencyKey)
      if (!config.keyId.trim()) return attempt
      testKey(config.keyId)
      if (config.immediateSubscriptionId && config.immediateSubscriptionId === config.futureSubscriptionId) {
        throw new Error('Use different subscriptions for immediate payment and future-start authorisation.')
      }

      let subscriptionId: string
      if (action === 'setup_autopay') {
        // A typed date alone cannot verify provider metadata; the human must enter the inspected start_at.
        if (!config.futureStartAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(config.futureStartAt)
          || !attempt.expected.chargeAt || !Number.isFinite(Date.parse(config.futureStartAt))
          || Date.parse(config.futureStartAt) !== Date.parse(attempt.expected.chargeAt)) return attempt
        testSubscription(config.futureSubscriptionId, 'future-start')
        subscriptionId = config.futureSubscriptionId
      } else {
        testSubscription(config.immediateSubscriptionId, 'immediate-start')
        subscriptionId = config.immediateSubscriptionId
      }
      if (usedSubscriptions.has(subscriptionId)) throw new Error('This Test subscription already returned a callback. Inspect its provider state before another attempt.')
      providerAttempts.set(attempt.attemptId, subscriptionId)
      const providerAttempt: BillingCheckoutAttempt = {
        ...attempt,
        mode: 'provider',
        config: { keyId: config.keyId, subscriptionId, name: 'MithraDirect', description: 'Vendor platform membership · Test Mode' },
      }
      return providerAttempt
    },
    async submitCheckout(attempt, callback) {
      if (attempt.vendorId !== vendorId) throw new Error('Checkout belongs to another vendor.')
      if (attempt.mode === 'simulated') {
        if (callback !== null) throw new Error('A simulated attempt cannot receive a provider callback.')
        lastAttemptWasProvider = false
        return fixture.submitCheckout(attempt, null)
      }
      const subscriptionId = providerAttempts.get(attempt.attemptId)
      const details = callback as SubscriptionCheckoutCallback | null
      if (!subscriptionId || !details?.razorpay_payment_id || !details.razorpay_signature
        || details.razorpay_subscription_id !== subscriptionId) {
        throw new Error('Checkout returned incomplete or mismatched details. Backend verification is required; access has not changed.')
      }
      usedSubscriptions.add(subscriptionId)
      providerAttempts.delete(attempt.attemptId)
      lastAttemptWasProvider = true
      return fixture.submitCheckout({ ...attempt, mode: 'simulated', config: null }, null)
    },
    async requestCancellation(selectedVendorId, idempotencyKey) {
      if (lastAttemptWasProvider) throw new Error('This preview cannot cancel a Razorpay Test subscription. Nothing was cancelled; inspect that subscription in the Test Dashboard.')
      return fixture.requestCancellation(selectedVendorId, idempotencyKey)
    },
    async simulateCancellationProgress(selectedVendorId, step) {
      if (lastAttemptWasProvider) throw new Error('A Test Checkout callback cannot be simulated into cancellation or refund progress.')
      if (!fixture.simulateCancellationProgress) throw new Error('Simulated cancellation progress is unavailable.')
      return fixture.simulateCancellationProgress(selectedVendorId, step)
    },
    async simulateRenewalProgress(selectedVendorId, step) {
      if (lastAttemptWasProvider) throw new Error('A Test Checkout callback cannot be simulated into renewal progress.')
      if (!fixture.simulateRenewalProgress) throw new Error('Simulated renewal progress is unavailable.')
      return fixture.simulateRenewalProgress(selectedVendorId, step)
    },
    async reconcileSimulatedCheckout(selectedVendorId, outcome = 'confirmed') {
      if (lastAttemptWasProvider) throw new Error('A Test Checkout callback cannot be simulated into verified authorisation.')
      if (!fixture.reconcileSimulatedCheckout) throw new Error('Simulated reconciliation is unavailable.')
      return fixture.reconcileSimulatedCheckout(selectedVendorId, outcome)
    },
  }
}
