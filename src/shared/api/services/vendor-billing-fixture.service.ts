import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import { mapVendorBillingStatus, rupeesToMinorPaise } from '../mappers/vendor-billing'
import { mapVendorContext } from '../mappers/vendor-onboarding'
import type { BillingCheckoutAttempt, BillingSource, SimulatedCancellationStep, SimulatedRenewalStep, VendorBillingService, VendorBillingStatus } from './vendor-billing.service'

export type BillingFixtureScenario = Exclude<keyof typeof fixtures.contexts, 'current_context'>

/** The dataset's trial_cancellation, paid_rejoin and refund journeys; nothing else advances cancellation. */
const CANCELLATION_REQUESTS: Partial<Record<BillingFixtureScenario, BillingFixtureScenario>> = {
  setup_confirmed: 'cancel_requested_trial',
  paid_active: 'cancel_scheduled_paid',
  paid_after_expiry: 'cancel_scheduled_paid',
}
const CANCELLATION_STEPS: Partial<Record<BillingFixtureScenario, Partial<Record<SimulatedCancellationStep, BillingFixtureScenario>>>> = {
  cancel_requested_trial: { cancellation_confirmed: 'cancel_confirmed_trial', cancellation_failed: 'cancel_failed' },
  // Confirming the old paid agreement's stop is what makes a safe replacement eligible.
  cancel_scheduled_paid: { cancellation_confirmed: 'rejoin_paid_ready', renewal_debit_collected: 'refund_owed' },
  refund_owed: { refund_started: 'refund_pending' },
  refund_pending: { refund_completed: 'refund_completed', refund_failed: 'refund_failed' },
}
/**
 * The dataset's renewal_retry and renewal_halted journeys. While a renewal is retried the store stays open; a retry
 * that succeeds keeps the original cycle, and a halt after every retry is the failure. Renewal periods come from the
 * contexts, never from the retry time.
 */
const RENEWAL_STEPS: Partial<Record<BillingFixtureScenario, Partial<Record<SimulatedRenewalStep, BillingFixtureScenario>>>> = {
  paid_active: { renewal_due: 'renewal_pending' },
  paid_after_expiry: { renewal_due: 'renewal_pending' },
  renewal_pending: { renewal_retry_confirmed: 'retry_recovered', renewal_failed: 'renewal_failed' },
}
/** A paid replacement's pending context; other setups use the generic trial-setup context. */
const REPLACEMENT_PENDING: Partial<Record<BillingFixtureScenario, BillingFixtureScenario>> = {
  rejoin_paid_ready: 'rejoin_paid_pending',
  authorisation_revoked_paid: 'rejoin_paid_pending',
}
type RefundStatus = NonNullable<VendorBillingStatus['refund']>['status']
const REFUND_STEPS: Partial<Record<RefundStatus, Partial<Record<SimulatedCancellationStep, RefundStatus>>>> = {
  owed: { refund_started: 'pending' },
  pending: { refund_completed: 'completed', refund_failed: 'failed' },
}
/** Explicit simulated outcomes for each pending Checkout context. */
const RECONCILED: Partial<Record<BillingFixtureScenario, Record<'confirmed' | 'failed', BillingFixtureScenario>>> = {
  setup_pending: { confirmed: 'setup_confirmed', failed: 'authorisation_failed' },
  first_fee_pending: { confirmed: 'paid_after_expiry', failed: 'first_fee_failed' },
  // A confirmed paid replacement is ordinary paid coverage at the same boundary.
  rejoin_paid_pending: { confirmed: 'paid_active', failed: 'rejoin_paid_ready' },
}

/** Rejoining reuses setup_autopay; the example follows the retained trial or paid boundary. */
function preparationExample(action: BillingCheckoutAttempt['action'], status: VendorBillingStatus) {
  if (action === 'pay_first_fee') return fixtures.prepareCheckout.after_expiry.response
  if (status.trial.status !== 'active') return fixtures.prepareCheckout.rejoin_paid.response
  return status.cancellation || status.authorisation.status === 'revoked' ? fixtures.prepareCheckout.rejoin_trial.response : fixtures.prepareCheckout.during_trial.response
}

export function billingFixtureVendorId(scenario: BillingFixtureScenario): string {
  return String(fixtures.contexts[scenario].data.vendor_id)
}

/** Proposed wire-shaped fixtures only. No auth, provider, order or real vendor state is changed. */
export function createVendorBillingMockService(
  initialScenario: BillingFixtureScenario,
  source: Extract<BillingSource, 'mock' | 'demo' | 'preview'> = 'mock',
  presentAs?: string,
  /** A derived combination: an obligation from another authorised context carried into this one. */
  derived: { outstandingRefund?: VendorBillingStatus['refund'] } = {},
): VendorBillingService {
  let scenario = initialScenario
  let attemptNumber = 0
  const preparations = new Map<string, BillingCheckoutAttempt>()
  const preparing = new Map<string, { vendorId: string; action: BillingCheckoutAttempt['action']; result: Promise<BillingCheckoutAttempt> }>()
  const attempts = new Map<string, BillingCheckoutAttempt>()
  const submitted = new Set<string>()
  const cancellations = new Map<string, { vendorId: string; result: Promise<void> }>()
  let preservedEntitlement: Pick<VendorBillingStatus, 'trial' | 'serverTime' | 'accessStatus' | 'storeVisible' | 'capabilities'> | null = null
  let revisionFloor = 0
  // A prepared replacement becomes the current agreement, so the old agreement's cancellation stops describing it.
  let replacementPreparedIn: BillingFixtureScenario | null = null
  // Refund obligations belong to the ledger, not the agreement: a replacement never clears one.
  let carriedRefund: VendorBillingStatus['refund'] = derived.outstandingRefund ?? null
  // Where a failed paid replacement returns to; the dataset's ready context carries a cancellation this path never had.
  let replacedFrom: BillingFixtureScenario | null = null
  // No dataset context confirms a new first fee after earlier paid coverage, so that outcome is not simulated.
  let firstFeeAfterPaidCoverage = false
  // Fixture contexts carry their own dates; the simulated clock never runs backwards between them.
  let serverTimeFloor = ''

  const getStatus: VendorBillingService['getStatus'] = async (vendorId) => {
    const fixture = fixtures.contexts[scenario]
    const context = mapVendorContext(presentAs ? { ...fixture, data: { ...fixture.data, vendor_id: presentAs } } : fixture)
    const listed = mapVendorBillingStatus(context, source, vendorId)
    // Offer cancel only where a simulated journey exists; elsewhere confirming could only fail.
    const mapped = CANCELLATION_REQUESTS[scenario] ? listed : { ...listed, availableActions: listed.availableActions.filter((action) => action !== 'cancel') }
    const renewalSteps = Object.keys(RENEWAL_STEPS[scenario] ?? {}) as SimulatedRenewalStep[]
    const serverTime = preservedEntitlement?.serverTime ?? mapped.serverTime
    if (!serverTimeFloor || Date.parse(serverTime) > Date.parse(serverTimeFloor)) serverTimeFloor = serverTime
    return {
      ...mapped,
      ...preservedEntitlement,
      serverTime: serverTimeFloor,
      ...(replacementPreparedIn === scenario ? { cancellation: null } : {}),
      refund: mapped.refund ?? carriedRefund,
      revision: Math.max(mapped.revision, revisionFloor),
      ...(renewalSteps.length ? { simulatedRenewalSteps: renewalSteps } : {}),
    }
  }

  return {
    getStatus,
    async prepareCheckout(vendorId, action, idempotencyKey) {
      if (!idempotencyKey.trim()) throw new Error('A billing request key is required.')
      const existing = preparations.get(idempotencyKey)
      if (existing) {
        if (existing.vendorId !== vendorId || existing.action !== action) throw new Error('A billing request key cannot be reused for another action.')
        return structuredClone(existing)
      }
      const pending = preparing.get(idempotencyKey)
      if (pending) {
        if (pending.vendorId !== vendorId || pending.action !== action) throw new Error('A billing request key cannot be reused for another action.')
        return structuredClone(await pending.result)
      }
      const result = (async () => {
        const status = await getStatus(vendorId)
        if (!status.availableActions.includes(action)) throw new Error('This billing action is not available for the current status.')
        const response = preparationExample(action, status)
        const example = response.data
        const attempt: BillingCheckoutAttempt = {
          attemptId: `${example.attempt_id}_${++attemptNumber}`,
          vendorId,
          action,
          mode: 'simulated',
          config: null,
          expected: {
            amountMinor: rupeesToMinorPaise(example.amount),
            currency: 'INR',
            chargeAt: example.charge_at,
            authorisationAmountMinor: example.authorisation_amount === null ? null : rupeesToMinorPaise(example.authorisation_amount),
          },
          // Keep the fixture's ten-minute lifetime usable when the dated example is replayed later.
          expiresAt: new Date(Date.now() + Date.parse(example.expires_at) - Date.parse(response.timestamp)).toISOString(),
        }
        if (status.cancellation) {
          replacementPreparedIn = scenario
          revisionFloor = status.revision + 1
        }
        preparations.set(idempotencyKey, attempt)
        attempts.set(attempt.attemptId, attempt)
        return attempt
      })()
      preparing.set(idempotencyKey, { vendorId, action, result })
      try { return structuredClone(await result) } finally { preparing.delete(idempotencyKey) }
    },
    async submitCheckout(attempt, callback) {
      const expected = attempts.get(attempt.attemptId)
      if (!expected || submitted.has(attempt.attemptId) || expected.vendorId !== attempt.vendorId || expected.action !== attempt.action || callback !== null) {
        throw new Error('The simulated Checkout attempt is missing, already used or mismatched.')
      }
      const before = await getStatus(attempt.vendorId)
      if (!before.availableActions.includes(attempt.action)) throw new Error('This prepared action is no longer available.')
      const replacement = attempt.action === 'setup_autopay' ? REPLACEMENT_PENDING[scenario] : undefined
      // Generic pending contexts borrow the current entitlement; a paid replacement has its own exact context.
      preservedEntitlement = replacement ? null : {
        trial: before.trial,
        serverTime: before.serverTime,
        accessStatus: before.accessStatus,
        storeVisible: before.storeVisible,
        capabilities: before.capabilities,
      }
      carriedRefund = before.refund
      replacedFrom = replacement ? scenario : null
      firstFeeAfterPaidCoverage = attempt.action === 'pay_first_fee' && before.membership.paidThrough !== null
      revisionFloor = before.revision + 1
      submitted.add(attempt.attemptId)
      scenario = replacement ?? (attempt.action === 'setup_autopay' ? 'setup_pending' : 'first_fee_pending')
      return getStatus(attempt.vendorId)
    },
    async requestCancellation(vendorId, idempotencyKey) {
      if (!idempotencyKey.trim()) throw new Error('A billing request key is required.')
      const prior = cancellations.get(idempotencyKey)
      if (prior) {
        if (prior.vendorId !== vendorId) throw new Error('A billing request key cannot be reused for another action.')
        await prior.result
        return getStatus(vendorId)
      }
      // The acknowledgement moves to the journey's next context; the returned status is a fresh read.
      const result = (async () => {
        const before = await getStatus(vendorId)
        const next = CANCELLATION_REQUESTS[scenario]
        if (!before.availableActions.includes('cancel') || !next) throw new Error('Cancellation is not available for the current billing status.')
        revisionFloor = before.revision + 1
        replacementPreparedIn = null
        scenario = next
      })()
      cancellations.set(idempotencyKey, { vendorId, result })
      try { await result } catch (cause) { cancellations.delete(idempotencyKey); throw cause }
      return getStatus(vendorId)
    },
    async simulateCancellationProgress(vendorId, step) {
      const before = await getStatus(vendorId)
      const next = CANCELLATION_STEPS[scenario]?.[step]
      const nextRefundStatus = !next && carriedRefund ? REFUND_STEPS[carriedRefund.status]?.[step] : undefined
      if (!next && !nextRefundStatus) throw new Error('This simulated cancellation or refund step is not available for the current billing status.')
      revisionFloor = before.revision + 1
      if (next) scenario = next
      else if (carriedRefund && nextRefundStatus) carriedRefund = { ...carriedRefund, status: nextRefundStatus }
      return getStatus(vendorId)
    },
    async simulateRenewalProgress(vendorId, step) {
      const before = await getStatus(vendorId)
      const next = RENEWAL_STEPS[scenario]?.[step]
      if (!next) throw new Error('This simulated renewal step is not available for the current billing status.')
      revisionFloor = before.revision + 1
      preservedEntitlement = null
      scenario = next
      return getStatus(vendorId)
    },
    async reconcileSimulatedCheckout(vendorId, outcome = 'confirmed') {
      const before = await getStatus(vendorId)
      const outcomes = RECONCILED[scenario]
      if (!outcomes) throw new Error('Only a pending simulated Checkout can be reconciled here.')
      if (outcome === 'confirmed' && firstFeeAfterPaidCoverage) {
        throw new Error('This sample has no confirmed context for a new fee after earlier paid coverage. Simulate a failure or choose another sample.')
      }
      revisionFloor = before.revision + 1
      // A failed paid replacement returns to the context it replaced, with that context's own coverage and history.
      scenario = outcome === 'failed' && scenario === 'rejoin_paid_pending' && replacedFrom ? replacedFrom : outcomes[outcome]
      if (outcome === 'failed') for (const attempt of attempts.values()) submitted.delete(attempt.attemptId)
      else attempts.clear()
      if (scenario === 'paid_after_expiry') preservedEntitlement = null
      return getStatus(vendorId)
    },
  }
}
