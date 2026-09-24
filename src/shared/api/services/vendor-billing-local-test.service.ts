import type { BillingAction, BillingCheckoutAttempt, VendorBillingService, VendorBillingStatus } from './vendor-billing.service'

export type LocalTestScenario = 'active_trial' | 'expired_trial' | 'paid_sample'

/** How reset left one provider object recorded for the scenario; only the first three are settled. */
export type LocalTestResetOutcome = 'closed' | 'cancelled_by_reset' | 'never_created'
  | 'cancel_requested' | 'cancel_acknowledged' | 'cancel_rejected' | 'read_failed' | 'not_owned' | 'creation_uncertain'

export interface LocalTestResetObject {
  associationId: string | null
  action: BillingAction
  outcome: LocalTestResetOutcome
  providerStatus: string | null
}

/** A reset generation's scrubbed record: dates, provider associations, observed outcomes and reset progress. */
export interface LocalTestHistoryEntry {
  generation: number
  scenario: LocalTestScenario
  selectedAt: string
  trialEndsAt: string
  paidThrough: string | null
  resetRequestedAt: string
  resetCompletedAt: string
  attempts: Array<{ action: BillingAction; state: string; associationId: string | null; fee: FeePeriod | null; renewals: FeePeriod[] }>
  objects: LocalTestResetObject[]
}

/** The selected vendor's current generation, if any, its reset progress and its earlier generations. */
export interface LocalTestScenarioState {
  scenario: LocalTestScenario | null
  generation: number | null
  /** Provider objects, or possible objects, recorded for the current generation. */
  objectCount: number
  reset: { requestedAt: string; objects: LocalTestResetObject[] } | null
  history: LocalTestHistoryEntry[]
}

interface LocalTestRecord {
  vendorId: string
  scenario: LocalTestScenario
  /** Absent on records saved before reset existed, which are the first generation. */
  generation?: number
  /** A pending reset; the helper withholds every billing action meanwhile. */
  reset?: { state: 'pending'; requestedAt: string; objects: LocalTestResetObject[] }
  revision: number
  serverTime: string
  trialStatus: VendorBillingStatus['trial']['status']
  trialEndsAt: string
  paidThrough: string | null
  daysRemaining: number
  accessStatus: VendorBillingStatus['accessStatus']
  storeVisible: boolean
  nextChargeAt: string | null
  availableActions: BillingAction[]
  authorisationStatus: 'not_configured' | 'pending' | 'confirmed' | 'failed' | 'revoked'
  paymentStatus: 'none' | 'pending' | 'confirmed' | 'failed'
  providerVerified: { authorisation: boolean; payment: boolean; coverage: boolean }
  /** The current agreement's helper cancellation; a replaced agreement's stays in its attempt history. */
  cancellation: {
    status: NonNullable<VendorBillingStatus['cancellation']>['status']
    /** `requested` is unanswered by Razorpay Test; `acknowledged` is an accepted immediate stop not yet read back. */
    stage: CancellationStage; mode: 'immediate' | 'cycle_end'; requestedAt: string; effectiveAt: string | null
  } | null
  /** Whether this read reached Razorpay Test; an unavailable read keeps the recorded results. */
  providerCheck: 'current' | 'unavailable' | 'deferred' | 'not_checked'
  attempts: Array<{
    action: BillingAction; state: string; associationId: string | null; problem?: VerificationProblem | null
    expected?: BillingCheckoutAttempt['expected']
    fee?: FeePeriod | null
    /** Confirmed renewals along the original cycle chain after the first fee. */
    renewals?: FeePeriod[]
    /** Razorpay Test's latest due fee after confirmed coverage, or a paid charge it did not count. */
    renewal?: { dueAt: string; status: 'pending' | 'failed' | null; problem: 'uncounted' | null } | null
    /** Razorpay Test's latest subscription status after a confirmed fee; confirmed coverage survives any of them. */
    providerStatus?: string
    cancellation?: { state: CancellationStage; effectiveAt: string | null } | null
  }>
  associations: Array<{ id: string; state: string }>
}

type VerificationProblem = 'ownership' | 'plan' | 'schedule' | 'period'
type CancellationStage = 'requested' | 'acknowledged' | 'scheduled' | 'confirmed' | 'failed'
type FeePeriod = { amountMinor: number; currency: 'INR'; periodStart: string; periodEnd: string }

interface HelperReply { record?: LocalTestRecord | null; history?: LocalTestHistoryEntry[]; attempt?: BillingCheckoutAttempt; error?: string }

const endpoint = '/__local_vendor_billing_test'

async function helperRequest(vendorId: string, operation: string, payload?: object): Promise<HelperReply> {
  try {
    const response = await fetch(`${endpoint}/vendors/${encodeURIComponent(vendorId)}/${operation}`, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'content-type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    })
    const body = await response.json() as HelperReply
    if (!response.ok) throw new Error(body.error ?? 'Local Test helper is unavailable.')
    if (body.record && body.record.vendorId !== vendorId) throw new Error('The local Test helper returned another vendor.')
    return body
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error('Local Test helper is unavailable. Start npm run dev:billing-helper with Test credentials, then refresh Plan.', { cause: error })
    }
    throw error
  }
}

const displayDate = (value: string) => `${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} IST`

const attemptStates: Record<string, string> = {
  provider_requested: 'provider request outcome uncertain',
  association_unverified: 'provider object recorded, outcome unverified',
  callback_unverified: 'callback received, verification pending',
  callback_verified: 'callback signature verified by the helper, Razorpay Test confirmation pending',
  provider_pending: 'Razorpay Test shows collection pending, halted or paused, so nothing is confirmed',
  needs_verification: 'provider object no longer fresh, verification needed',
  schedule_mismatch: 'provider schedule or plan mismatch, Checkout blocked',
  provider_closed: 'Razorpay Test shows the subscription closed without a confirmed platform fee',
}

const problems: Record<VerificationProblem, string> = {
  ownership: 'Razorpay Test shows it belongs to another vendor or attempt, so nothing is counted',
  plan: 'Razorpay Test shows a different plan or fee from the preparation, so nothing is counted',
  schedule: 'Razorpay Test shows a start other than the original trial expiry or paid-through date, so nothing is counted',
  period: 'Razorpay Test shows a charge for another billing period, so it is not counted as the first fee',
}

function attemptSummary({ action, state, expected, problem, cancellation }: LocalTestRecord['attempts'][number]): string | null {
  // A helper-cancelled object is described by the cancellation lines instead.
  if (!attemptStates[state] || cancellation?.state === 'confirmed') return null
  if (problem) return `Recorded Test preparation: ${problems[problem]}; verification needed.`
  const kind = action === 'setup_autopay' ? 'AutoPay setup, first platform fee' : 'first platform fee'
  if (!expected) return `Recorded Test preparation: ${kind}; ${attemptStates[state]}.`
  const fee = `${new Intl.NumberFormat('en-IN', { style: 'currency', currency: expected.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(expected.amountMinor / 100)} ${expected.currency}`
  const when = expected.chargeAt
    ? `due ${displayDate(expected.chargeAt)}`
    : 'collected now'
  return `Recorded Test preparation: ${kind} ${fee} ${when}; ${attemptStates[state]}.`
}

const confirmedFeeAttempts = (record: LocalTestRecord) => record.attempts.filter((attempt) => attempt.state === 'fee_confirmed')
/** The latest provider object is the current agreement; earlier ones are history. */
const currentAgreement = (record: LocalTestRecord) => [...record.attempts].reverse().find((attempt) => attempt.associationId)

/** Separates what Razorpay Test records confirmed from the locally simulated scenario. */
function provenance(record: LocalTestRecord): string {
  const periods = confirmedFeeAttempts(record).flatMap((paid) => paid.fee ? [paid.fee, ...(paid.renewals ?? [])] : [])
  const verified = [
    record.providerVerified.authorisation ? 'AutoPay authorisation' : null,
    periods.length ? `platform fees captured for ${periods.map((period) => `${displayDate(period.periodStart)} to ${displayDate(period.periodEnd)}`).join(', ')}` : null,
  ].filter(Boolean)
  const simulated = record.scenario === 'paid_sample' ? 'Trial, access, restrictions and the paid sample are simulated locally.'
    : 'Trial dates, access and restrictions are simulated locally; real account access is unchanged.'
  return `${simulated} ${verified.length ? `Razorpay Test verified: ${verified.join(' and ')}.` : 'No provider authorisation or platform fee has been verified.'}`
}

/** Provider-observed renewal facts, always stated against the original due date. */
function renewalSummary(record: LocalTestRecord): string[] {
  const paid = confirmedFeeAttempts(record).at(-1)
  // A replacement agreement owns what is collected next; the paid one it replaced is history.
  if (!paid || paid !== currentAgreement(record)) return []
  const { renewal, providerStatus } = paid
  const helperCancelled = paid.cancellation?.state === 'confirmed'
  return [
    renewal?.status === 'failed' ? `Razorpay Test shows the platform fee due ${displayDate(renewal.dueAt)} failed; paid coverage is not extended until that same fee is collected.`
      : renewal?.status === 'pending' ? `Razorpay Test shows the platform fee due ${displayDate(renewal.dueAt)} issued but not yet collected.` : null,
    renewal?.problem ? 'Razorpay Test shows a charge that is not the next original billing cycle, so it is not counted and the renewal date is unchanged.' : null,
    helperCancelled ? null
      : providerStatus === 'cancelled' ? 'Razorpay Test shows this subscription cancelled outside this Plan page, for example in the Test Dashboard or by the card issuer; no further platform fee can be collected. Confirmed coverage is kept.'
      : providerStatus === 'expired' ? 'Razorpay Test shows this subscription expired; no further platform fee can be collected. Confirmed coverage is kept.'
      : providerStatus === 'completed' ? 'Razorpay Test shows this finite Test schedule completed; no further platform fee is scheduled. Confirmed coverage is kept.'
        : providerStatus === 'halted' ? 'Razorpay Test shows collection halted after failed retries. Confirmed coverage is kept.' : null,
  ].filter((line): line is string => Boolean(line))
}

/** Separates an unanswered request, provider acceptance, a scheduled stop and a read-confirmed cancellation. */
function cancellationSummary(record: LocalTestRecord): string[] {
  const current = currentAgreement(record)
  const replaced = record.attempts.filter((attempt) => attempt !== current && attempt.cancellation?.state === 'confirmed')
  const lines = replaced.map((attempt) => `An earlier Test AutoPay agreement was cancelled at your request${attempt.cancellation?.effectiveAt ? ` as of ${displayDate(attempt.cancellation.effectiveAt)}` : ''}; a new AutoPay setup replaces it.`)
  const { cancellation } = record
  if (!cancellation) return lines
  return [...lines, {
    requested: 'Your cancellation request is recorded, but Razorpay Test has not confirmed receiving it, so AutoPay may still collect. Refresh billing status; Cancel AutoPay retries the same request.',
    acknowledged: 'Razorpay Test accepted the request to stop AutoPay now. It is shown cancelled only once a status read confirms it.',
    scheduled: `Razorpay Test accepted a stop at the end of the paid cycle${cancellation.effectiveAt ? `, ${displayDate(cancellation.effectiveAt)}` : ''}. The subscription stays active until then, and a replacement is offered only once Razorpay Test shows it cancelled.`,
    confirmed: 'Razorpay Test shows this subscription cancelled at your request. A cancellation is not a refund; no refund was requested.',
    failed: 'Razorpay Test rejected the cancellation request, so AutoPay can still collect. Refresh billing status before trying again.',
  }[cancellation.stage]]
}

function toStatus(record: LocalTestRecord): VendorBillingStatus {
  // A read that missed the provider cannot justify a new billing change.
  const unchecked = record.providerCheck === 'unavailable' || record.providerCheck === 'deferred'
  return {
    vendorId: record.vendorId, source: 'local_test', serverTime: record.serverTime, revision: record.revision,
    plan: { code: 'monthly_test', name: 'Local Test scenario · ₹299 monthly sample', amountMinor: 29900, currency: 'INR', interval: 'month' },
    setupPendingReason: null,
    trial: { status: record.trialStatus, endsAt: record.trialEndsAt, daysRemaining: record.daysRemaining },
    authorisation: { status: record.authorisationStatus },
    membership: { paymentStatus: record.paymentStatus, paidThrough: record.paidThrough, nextChargeAt: record.nextChargeAt },
    cancellation: record.cancellation ? { status: record.cancellation.status, requestedAt: record.cancellation.requestedAt, effectiveAt: record.cancellation.effectiveAt } : null,
    // Cancellation-race and refund progress exist only as labelled simulated samples; the helper performs no Test refund.
    refund: null,
    notice: [provenance(record), ...renewalSummary(record), ...cancellationSummary(record), ...record.attempts.map(attemptSummary).filter(Boolean),
      record.reset ? 'A Test scenario reset is pending: at least one of its Razorpay Test subscriptions is not yet confirmed closed, so no Checkout or cancellation starts until the reset is retried and completes.' : null,
      unchecked ? 'Razorpay Test status could not be read just now, so recorded results are shown and billing changes are paused. Refresh billing status to retry.' : null,
    ].filter(Boolean).join(' '),
    accessStatus: record.accessStatus,
    capabilities: record.storeVisible ? ['VIEW', 'ORDERS', 'CATALOG', 'NEW_ORDERS'] : ['VIEW', 'ORDERS', 'FULFILL_EXISTING_ORDERS'],
    storeVisible: record.storeVisible, availableActions: unchecked ? [] : record.availableActions,
    providerVerified: { ...record.providerVerified, cancellation: record.cancellation?.stage === 'confirmed' },
  }
}

function toScenarioState({ record, history }: HelperReply): LocalTestScenarioState {
  return {
    scenario: record?.scenario ?? null, generation: record ? record.generation ?? 1 : null,
    objectCount: record?.attempts.filter((attempt) => attempt.associationId || attempt.state === 'provider_requested').length ?? 0,
    reset: record?.reset ? { requestedAt: record.reset.requestedAt, objects: record.reset.objects } : null,
    history: history ?? [],
  }
}

/** Separate from Spring context and ordinary demo state; status reads cannot create provider objects or reset a scenario. */
export function createVendorBillingLocalTestService(): VendorBillingService & {
  readScenario: (vendorId: string) => Promise<LocalTestScenarioState>
  selectScenario: (vendorId: string, scenario: LocalTestScenario) => Promise<VendorBillingStatus>
  /**
   * Asks the helper to reconcile and cancel the named generation's Test subscriptions. It completes only
   * once every one is read closed; otherwise the returned state keeps the reset pending.
   */
  resetScenario: (vendorId: string, current: { scenario: LocalTestScenario; generation: number }, idempotencyKey: string) => Promise<LocalTestScenarioState>
} {
  async function getStatus(vendorId: string) {
    const { record } = await helperRequest(vendorId, 'status')
    if (!record) throw new Error('Choose a local Test scenario for this vendor.')
    return toStatus(record)
  }
  return {
    getStatus,
    async readScenario(vendorId) { return toScenarioState(await helperRequest(vendorId, 'status')) },
    async selectScenario(vendorId, scenario) {
      const { record } = await helperRequest(vendorId, 'scenario', { scenario })
      if (!record) throw new Error('The selected Test scenario was not saved.')
      return toStatus(record)
    },
    async resetScenario(vendorId, { scenario, generation }, idempotencyKey) {
      return toScenarioState(await helperRequest(vendorId, 'resets', { scenario, generation, idempotencyKey }))
    },
    /** The helper creates and inspects the provider object; the browser only receives its public Checkout values. */
    async prepareCheckout(vendorId, action, idempotencyKey) {
      const { attempt } = await helperRequest(vendorId, 'preparations', { action, idempotencyKey })
      if (!attempt || attempt.vendorId !== vendorId || attempt.action !== action || attempt.mode !== 'provider'
        || !/^rzp_test_[A-Za-z0-9]+$/.test(attempt.config?.keyId ?? '') || !/^sub_[A-Za-z0-9]+$/.test(attempt.config?.subscriptionId ?? '')) {
        throw new Error('The local helper returned something that is not a Razorpay Test Mode preparation for this vendor. Checkout was not opened.')
      }
      return attempt
    },
    /**
     * The helper verifies the signature server-side and stores neither it nor the payment ID. The
     * acknowledgement is followed by a fresh status read, which is what reports provider facts.
     */
    async submitCheckout(attempt, callback) {
      if (!callback || !attempt.config || callback.razorpay_subscription_id !== attempt.config.subscriptionId) {
        throw new Error('Checkout returned details for another Test subscription. Nothing was recorded; refresh billing status.')
      }
      await helperRequest(attempt.vendorId, 'submissions', {
        attemptId: attempt.attemptId, subscriptionId: attempt.config.subscriptionId,
        paymentId: callback.razorpay_payment_id, signature: callback.razorpay_signature,
      })
      return getStatus(attempt.vendorId)
    },
    /**
     * The helper records the request before asking Razorpay Test to stop the current agreement. The
     * acknowledgement is followed by a fresh status read, which alone can report the stop confirmed.
     */
    async requestCancellation(vendorId, idempotencyKey) {
      await helperRequest(vendorId, 'cancellations', { idempotencyKey })
      return getStatus(vendorId)
    },
  }
}
