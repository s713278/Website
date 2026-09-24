import { setDemoBillingPhase } from '../fixtures/demo-state'
import { mapVendorBillingStatus, VendorBillingUnavailableError } from '../mappers/vendor-billing'
import type { VendorContext } from '../mappers/vendor-onboarding'
import type { BillingCheckoutAttempt, VendorBillingService } from './vendor-billing.service'

type BillingAcknowledgements = {
  submitCheckout?: (...args: Parameters<VendorBillingService['submitCheckout']>) => Promise<void>
  requestCancellation?: (...args: Parameters<VendorBillingService['requestCancellation']>) => Promise<void>
}

/** The dashboard provider owns this read; every status is mapped from its accepted context. */
export function createVendorBillingContextService(
  source: 'demo' | 'backend',
  refreshContext: () => Promise<VendorContext>,
  acknowledgements: BillingAcknowledgements = {},
): VendorBillingService {
  const preparations = new Map<string, BillingCheckoutAttempt>()
  const preparing = new Map<string, { vendorId: string; action: BillingCheckoutAttempt['action']; result: Promise<BillingCheckoutAttempt> }>()
  const submitted = new Set<string>()
  const cancellations = new Map<string, { vendorId: string; result: Promise<void> }>()
  const getStatus: VendorBillingService['getStatus'] = async (vendorId) => {
    const context = await refreshContext()
    if (source === 'backend') throw new VendorBillingUnavailableError('Billing is unavailable until the authenticated backend integration is complete.')
    return mapVendorBillingStatus(context, source, vendorId)
  }

  return {
    getStatus,
    async prepareCheckout(vendorId, action, idempotencyKey) {
      if (source === 'backend') throw new Error('Billing setup is unavailable until the backend billing contract is connected.')
      if (!idempotencyKey.trim()) throw new Error('A billing request key is required.')
      const prior = preparations.get(idempotencyKey)
      if (prior) {
        if (prior.vendorId !== vendorId || prior.action !== action) throw new Error('A billing request key cannot be reused for another action.')
        return prior
      }
      const pending = preparing.get(idempotencyKey)
      if (pending) {
        if (pending.vendorId !== vendorId || pending.action !== action) throw new Error('A billing request key cannot be reused for another action.')
        return pending.result
      }
      const result = (async () => {
        const status = await getStatus(vendorId)
        if (!status.availableActions.includes(action)) throw new Error('This billing action is not available for the current status.')
        const attempt: BillingCheckoutAttempt = {
          attemptId: crypto.randomUUID(), vendorId, action, mode: 'simulated', config: null,
          expected: {
            amountMinor: status.plan.amountMinor, currency: 'INR',
            chargeAt: action === 'setup_autopay' ? status.trial.endsAt ?? status.membership.paidThrough : null,
            authorisationAmountMinor: null,
          },
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }
        preparations.set(idempotencyKey, attempt)
        if (status.cancellation) setDemoBillingPhase(vendorId, 'replacement_prepared')
        return attempt
      })()
      preparing.set(idempotencyKey, { vendorId, action, result })
      try { return await result } finally { preparing.delete(idempotencyKey) }
    },
    async submitCheckout(attempt, callback) {
      if (source === 'backend') throw new Error('Billing confirmation is unavailable until the backend billing contract is connected.')
      if (callback !== null || attempt.mode !== 'simulated' || submitted.has(attempt.attemptId)
        || ![...preparations.values()].some((prepared) => prepared.attemptId === attempt.attemptId && prepared.vendorId === attempt.vendorId && prepared.action === attempt.action)) {
        throw new Error('The simulated Checkout attempt is missing, already used or mismatched.')
      }
      if (acknowledgements.submitCheckout) await acknowledgements.submitCheckout(attempt, callback)
      else setDemoBillingPhase(attempt.vendorId, 'setup_pending')
      submitted.add(attempt.attemptId)
      return getStatus(attempt.vendorId)
    },
    async requestCancellation(vendorId, idempotencyKey) {
      if (source === 'backend') throw new Error('Cancellation is unavailable until the backend billing contract is connected.')
      if (!idempotencyKey.trim()) throw new Error('A billing request key is required.')
      if (acknowledgements.requestCancellation) {
        await acknowledgements.requestCancellation(vendorId, idempotencyKey)
        return getStatus(vendorId)
      }
      const prior = cancellations.get(idempotencyKey)
      if (prior) {
        if (prior.vendorId !== vendorId) throw new Error('A billing request key cannot be reused for another action.')
        await prior.result
        return getStatus(vendorId)
      }
      // The simulated acknowledgement records receipt only; confirmation needs an explicit simulated outcome.
      const result = (async () => {
        const status = await getStatus(vendorId)
        if (!status.availableActions.includes('cancel')) throw new Error('Cancellation is not available for the current billing status.')
        setDemoBillingPhase(vendorId, 'cancel_requested')
      })()
      cancellations.set(idempotencyKey, { vendorId, result })
      try { await result } catch (cause) { cancellations.delete(idempotencyKey); throw cause }
      return getStatus(vendorId)
    },
    async simulateCancellationProgress(vendorId, step) {
      if (source === 'backend') throw new Error('Simulated cancellation is unavailable for backend billing.')
      const status = await getStatus(vendorId)
      if (status.cancellation?.status !== 'requested' || (step !== 'cancellation_confirmed' && step !== 'cancellation_failed')) {
        throw new Error('This simulated cancellation step is not available for the current billing status.')
      }
      setDemoBillingPhase(vendorId, step === 'cancellation_failed' ? 'cancel_failed' : 'cancel_confirmed')
      return getStatus(vendorId)
    },
    async reconcileSimulatedCheckout(vendorId, outcome = 'confirmed') {
      if (source === 'backend') throw new Error('Simulated confirmation is unavailable for backend billing.')
      const status = await getStatus(vendorId)
      if (status.authorisation.status !== 'pending') throw new Error('Only a pending simulated setup can be confirmed.')
      setDemoBillingPhase(vendorId, outcome === 'failed' ? 'setup_failed' : 'setup_confirmed')
      if (outcome === 'failed') for (const attempt of preparations.values()) if (attempt.vendorId === vendorId) submitted.delete(attempt.attemptId)
      return getStatus(vendorId)
    },
  }
}
