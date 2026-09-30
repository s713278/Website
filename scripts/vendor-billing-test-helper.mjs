import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, renameSync, mkdirSync, openSync, closeSync, unlinkSync, fsyncSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prototypeSeed, prototypeStates } from '../src/shared/api/fixtures/billing-prototype.ts'

/** The earlier three scenarios stay readable for stored records such as vendor `r1`; Plan selects only the prototype states. */
const scenarios = ['active_trial', 'expired_trial', 'paid_sample', ...prototypeStates]
/** Scenarios whose seeded free days can still be running. */
const trialScenarios = ['active_trial', 'free_days', 'three_days_left']
/** Scenarios seeded with a labelled sample paid boundary rather than a provider-verified fee. */
const samplePaidScenarios = ['paid_sample', 'paid', 'stopped', 'shop_closed']
/** Prototype states whose ₹299 is collected now; a provider-confirmed fee moves them to Paid. */
const payNowScenarios = ['payment_failed', 'shop_closed']
const vendorPattern = /^[A-Za-z0-9_-]{1,80}$/
const keyPattern = /^[A-Za-z0-9_-]{8,100}$/
/** A browser callback or a no-longer-fresh provider object stays unresolved until provider verification. */
const unresolvedStates = ['callback_unverified', 'callback_verified', 'provider_pending', 'needs_verification', 'schedule_mismatch']
/** A provider outcome exists for these attempts, so preparation never reopens or replaces them. */
const settledStates = [...unresolvedStates, 'authorised', 'fee_confirmed', 'provider_closed']
/**
 * Status reads reread these associated attempts. Confirmed fees, closed objects and recorded
 * ownership/plan/schedule/period mismatches stay final until the guarded reset.
 */
const readbackStates = ['association_unverified', 'callback_unverified', 'callback_verified', 'provider_pending', 'needs_verification', 'authorised']
/** Only these statuses confirm authorisation; retrying, halted or paused collection stays pending. */
const authorisedStatuses = ['authenticated', 'active']
/** Razorpay statuses that can never charge again. */
const closedStatuses = ['cancelled', 'completed', 'expired']
/**
 * Razorpay statuses under which a scheduled fee is still being collected, its retries included (`pending`).
 * Only `halted`, after every retry is used, is a failed platform fee.
 */
const collectingStatuses = ['authenticated', 'active', 'pending']

/**
 * AutoPay after a confirmed fee: retrying (`pending`) and a finished Test schedule keep the observed
 * authorisation; cancellation or expiry revokes it; halted collection has failed; anything else is unconfirmed.
 * Records saved before renewal readback have no status and keep their confirmed authorisation.
 */
function authorisationAfterFee(providerStatus) {
  if (!providerStatus || ['authenticated', 'active', 'pending', 'completed'].includes(providerStatus)) return 'confirmed'
  if (['cancelled', 'expired'].includes(providerStatus)) return 'revoked'
  return providerStatus === 'halted' ? 'failed' : 'pending'
}
/** Razorpay has shown that this attempt's object can never charge again. */
const collectionEnded = (attempt) => attempt.state === 'provider_closed' || (attempt.state === 'fee_confirmed' && closedStatuses.includes(attempt.providerStatus))
/** A provider object exists, or may exist after an unanswered create. */
const hasObject = (attempt) => Boolean(attempt.associationId) || attempt.state === 'provider_requested'
/** A halted object whose cancellation Razorpay Test has not yet accepted; an unanswered or rejected request is retried. */
const haltedUncancelled = (attempt) => Boolean(attempt.haltedAt) && Boolean(attempt.attemptId) && attempt.providerStatus === 'halted'
  && (!attempt.cancellation || ['requested', 'failed'].includes(attempt.cancellation.state))
/** Helper cancellation progress still waiting for a provider read that shows the object closed. */
const openCancellationStates = ['requested', 'acknowledged', 'scheduled']
/**
 * Helper cancellation states that stop the prototype's Paid: a cycle-end stop Razorpay Test accepted (its reads
 * cannot show one) or a stop a read has confirmed. An accepted immediate stop waits for that read.
 */
const stopAcceptedStates = ['scheduled', 'confirmed']
/**
 * In the prototype's Stopped, a paid agreement with a scheduled cycle-end stop is closed now, and read closed,
 * before Keep shop open creates its replacement: provider reads cannot show the scheduled stop.
 */
const stopToClose = (record, attempt) => record.scenario === 'stopped' && attempt.state === 'fee_confirmed'
  && !collectionEnded(attempt) && attempt.cancellation?.state === 'scheduled'
/** Reset outcomes showing a recorded object can never charge again, or was never created. */
const resetTerminalOutcomes = ['closed', 'cancelled_by_reset', 'never_created']

/** The provider object is the one this helper created for this vendor attempt on the configured plan. */
const ownedBy = (subscription, { attempt, vendorId, planId }) => subscription.id === attempt.associationId && subscription.plan_id === planId
  && subscription.notes?.md_attempt === attempt.attemptId && subscription.notes?.md_vendor === vendorId

/** The approved platform fee; another plan price is never counted as the first fee. */
const platformFeeMinor = 29900
const preparationLifetimeMs = 30 * 60 * 1000
/** After this long, a creation absent from the provider list was never committed and may be retried. */
const uncertainCreationWindowMs = 10 * 60 * 1000

/** `definite` means Razorpay rejected the request, so no provider object was created. */
export class ProviderError extends Error {
  constructor(message, definite) { super(message); this.name = 'ProviderError'; this.definite = definite }
}

/** Test Mode REST client. The secret stays in this process; only its public key reaches the browser. */
export function createRazorpayTestProvider({ keyId, secret }) {
  const authorization = `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`
  async function call(method, path, body) {
    let response
    try {
      response = await fetch(`https://api.razorpay.com/v1${path}`, {
        method, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
        headers: { authorization, ...(body ? { 'content-type': 'application/json' } : {}) },
      })
    } catch { throw new ProviderError('Razorpay Test did not respond.', false) }
    const data = await response.json().catch(() => null)
    if (response.ok && data) return data
    const description = typeof data?.error?.description === 'string' ? data.error.description.slice(0, 200) : null
    throw new ProviderError(description ? `Razorpay Test rejected the request: ${description}` : 'Razorpay Test returned an unexpected response.', response.status >= 400 && response.status < 500)
  }
  return {
    createSubscription: (body) => call('POST', '/subscriptions', body),
    fetchSubscription: (id) => call('GET', `/subscriptions/${encodeURIComponent(id)}`),
    fetchPlan: (id) => call('GET', `/plans/${encodeURIComponent(id)}`),
    fetchPayment: (id) => call('GET', `/payments/${encodeURIComponent(id)}`),
    listInvoices: ({ subscriptionId }) => call('GET', `/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=100`),
    listSubscriptions: ({ planId, from, skip }) => call('GET', `/subscriptions?plan_id=${encodeURIComponent(planId)}&from=${from}&count=100&skip=${skip}`),
    cancelSubscription: (id, { cancelAtCycleEnd }) => call('POST', `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: cancelAtCycleEnd }),
  }
}

const seconds = (iso) => Math.floor(Date.parse(iso) / 1000)
const replaceAttempt = (record, attempt, next) => record.attempts.map((item) => item === attempt ? next : item)

/** Finds the object tagged with this attempt; an unreadably long list stays uncertain. */
async function findTaggedSubscription(client, { planId, attempt }) {
  for (let skip = 0; skip < 1000; skip += 100) {
    const { items = [] } = await client.listSubscriptions({ planId, from: seconds(attempt.requestedAt) - 300, skip })
    const found = items.find((item) => item.notes?.md_attempt === attempt.attemptId)
    if (found || items.length < 100) return found ?? null
  }
  throw new ProviderError('Razorpay Test returned too many subscriptions to reconcile.', false)
}

function scenarioDates(scenario, now) {
  if (prototypeStates.includes(scenario)) return prototypeSeed(scenario, now)
  const day = 24 * 60 * 60 * 1000
  const trialEndsAt = new Date(now.getTime() + (scenario === 'active_trial' ? 14 : -7) * day).toISOString()
  const paidThrough = scenario === 'paid_sample' ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds())).toISOString() : null
  return { trialEndsAt, paidThrough }
}

function currentStatus(record, now) {
  const attempts = record.attempts ?? []
  const nowMs = now.getTime()
  const trialActive = trialScenarios.includes(record.scenario) && nowMs < Date.parse(record.trialEndsAt)
  const sampleActive = samplePaidScenarios.includes(record.scenario) && nowMs < Date.parse(record.paidThrough)
  const has = (action, states) => attempts.some((attempt) => attempt.action === action && states.includes(attempt.state))
  // The latest provider object is the current agreement; an earlier one it replaced is history.
  const agreement = attempts.findLast(hasObject) ?? null
  // A rejected request that Razorpay later shows closed was not this Plan's cancellation: it reads as external revocation.
  const cancelling = agreement?.cancellation?.state === 'failed' && collectionEnded(agreement) ? null : agreement?.cancellation ?? null
  // Only provider-confirmed fees count; renewals extend the latest paid agreement only along its original cycle chain.
  const paidAttempt = attempts.findLast((attempt) => attempt.state === 'fee_confirmed') ?? null
  const fee = paidAttempt?.fee ?? null
  // A replacement prepared after the paid agreement decides what is collected next; the paid one keeps its coverage.
  const replacement = paidAttempt && agreement !== paidAttempt ? agreement : null
  // A closed object, or a scheduled or confirmed stop, collects nothing further.
  const collectionStopped = Boolean(paidAttempt) && (collectionEnded(paidAttempt) || ['scheduled', 'confirmed'].includes(paidAttempt.cancellation?.state))
  const paidThrough = (paidAttempt?.renewals?.at(-1) ?? fee)?.periodEnd ?? (samplePaidScenarios.includes(record.scenario) ? record.paidThrough : null)
  const paidActive = Boolean(paidThrough) && nowMs < Date.parse(paidThrough)
  const authorisation = !agreement ? 'not_configured'
    : cancelling?.state === 'confirmed' ? 'revoked'
      : agreement.state === 'fee_confirmed' ? authorisationAfterFee(agreement.providerStatus)
        : agreement.state === 'authorised' ? 'confirmed'
          : agreement.action === 'setup_autopay' && unresolvedStates.includes(agreement.state) ? 'pending'
            : agreement.action === 'setup_autopay' && agreement.state === 'provider_closed' ? 'failed' : 'not_configured'
  const setupAuthorised = agreement?.action === 'setup_autopay' && agreement.state === 'authorised' ? agreement : null
  // A trial AutoPay object may still charge at the boundary until the provider shows it closed.
  const trialObject = attempts.some((attempt) => attempt.action === 'setup_autopay' && attempt.state !== 'provider_closed' && hasObject(attempt))
  // The latest due fee is the cycle starting where confirmed coverage ends; a recorded outcome for an older cycle is history.
  const renewal = !replacement && paidAttempt?.renewal?.dueAt === paidThrough ? paidAttempt.renewal : null
  // Past the paid boundary, the replacement's first fee at that boundary is due.
  const replacementDue = Boolean(replacement) && !paidActive && (replacement.state === 'authorised' || unresolvedStates.includes(replacement.state))
  // Rejoining is safe only when every earlier object is closed at Razorpay; an unfinished preparation is reused, never duplicated.
  const collecting = attempts.filter((attempt) => hasObject(attempt) && !collectionEnded(attempt))
  const replaceable = collecting.every((attempt) => (attempt.action === 'setup_autopay' && !settledStates.includes(attempt.state)) || stopToClose(record, attempt))
  const retained = trialActive || sampleActive || (Boolean(fee) && paidActive)
  // The collection retry period: past its boundary, a scheduled fee Razorpay is still collecting keeps service until
  // collection halts. A fee paid now (Pay ₹299) has none, and a cancellation ends the retries.
  const scheduled = replacement ?? paidAttempt ?? (agreement?.action === 'setup_autopay' ? agreement : null)
  const retrying = !retained && !paidActive && Boolean(scheduled) && !scheduled.haltedAt
    && (scheduled.state === 'fee_confirmed' || (scheduled.action === 'setup_autopay' && ['authorised', 'provider_pending'].includes(scheduled.state)))
    && (!scheduled.providerStatus || collectingStatuses.includes(scheduled.providerStatus))
    && renewal?.status !== 'failed' && (!scheduled.cancellation || scheduled.cancellation.state === 'failed')
  // After a halt, that agreement is history: Pay ₹299 returns once every object reads closed, so two never overlap.
  const lastHalt = attempts.findLastIndex((attempt) => attempt.haltedAt)
  const payable = lastHalt >= 0
    ? collecting.length === 0 && !attempts.slice(lastHalt + 1).some((attempt) => attempt.action === 'pay_first_fee' && settledStates.includes(attempt.state))
    : !fee && !trialObject && !has('pay_first_fee', settledStates)
  // Only a helper-created object that can still collect is cancelled; an unanswered or rejected request may be retried.
  const cancellable = Boolean(agreement?.attemptId) && (['authorised', 'provider_pending'].includes(agreement.state) || (agreement.state === 'fee_confirmed' && !collectionEnded(agreement)))
    && (!cancelling || ['requested', 'failed'].includes(cancelling.state))
  // The prototype's sample Paid has no provider object, so stopping it is a local state change.
  const sampleStop = record.scenario === 'paid' && Boolean(record.events) && !agreement && sampleActive
  // A pending reset owns every recorded object, so no billing change starts meanwhile.
  const availableActions = record.reset ? [] : [
    ...(retained ? (replaceable ? ['setup_autopay'] : [])
      : (!samplePaidScenarios.includes(record.scenario) || payNowScenarios.includes(record.scenario)) && payable ? ['pay_first_fee'] : []),
    ...(cancellable || sampleStop ? ['cancel'] : []),
  ]
  const paymentStatus = fee ? (replacement ? (replacementDue ? 'pending' : 'confirmed') : renewal?.status ?? (paidActive || collectionStopped ? 'confirmed' : 'pending'))
    : has('pay_first_fee', [...unresolvedStates, 'authorised']) || (setupAuthorised && !trialActive && !sampleActive) || retrying ? 'pending' : 'none'
  return {
    trialStatus: trialActive ? 'active' : 'ended',
    // Past a confirmed or sample paid boundary the demonstration is restricted, with no grace period once collection has
    // halted. Through the retry period, access stays as the coverage that just ended left it.
    accessStatus: trialActive || (retrying && !paidThrough) ? 'TRIAL' : paidActive || retrying ? 'PAID' : paidThrough ? 'PAYMENT_REQUIRED' : 'TRIAL_ENDED',
    daysRemaining: trialActive ? Math.ceil((Date.parse(record.trialEndsAt) - nowMs) / (24 * 60 * 60 * 1000)) : 0,
    storeVisible: Boolean(trialActive || paidActive || retrying),
    collectionRetrying: retrying,
    paidThrough,
    // The renewal date stays the original anchor; a closed or stopping object schedules nothing further.
    nextChargeAt: replacement ? (replacement.state === 'authorised' ? replacement.expectedChargeAt ?? null : null)
      : fee ? (collectionStopped ? null : paidThrough) : setupAuthorised?.expectedChargeAt ?? null,
    availableActions,
    authorisationStatus: authorisation,
    paymentStatus,
    // A due fee past the local boundary with no provider record yet is local simulation, not a provider fact,
    // while the confirmed coverage it follows remains Razorpay's.
    providerVerified: {
      authorisation: authorisation === 'confirmed',
      payment: Boolean(fee) && (replacement ? !replacementDue : paidActive || collectionStopped || Boolean(renewal?.status)),
      coverage: Boolean(fee),
    },
    // Only the current agreement's progress is shown; a replaced agreement's cancellation stays in its attempt history.
    // Razorpay's acceptance of an immediate stop is still only a request until a read shows the object cancelled.
    cancellation: cancelling ? {
      status: cancelling.state === 'acknowledged' ? 'requested' : cancelling.state,
      stage: cancelling.state, mode: cancelling.mode, requestedAt: cancelling.requestedAt, effectiveAt: cancelling.effectiveAt ?? null,
      // Only when the helper cancelled after Razorpay halted collection, rather than at the vendor's request.
      ...(cancelling.reason ? { reason: cancelling.reason } : {}),
    } : null,
  }
}

const iso = (value) => new Date(value * 1000).toISOString()
const monthlyInvoice = (item, subscriptionId, amount) => item.subscription_id === subscriptionId && item.amount === amount && item.currency === 'INR'
const coversOneMonth = (invoice) => { const days = (invoice.billing_end - invoice.billing_start) / 86400; return days >= 28 && days <= 31 }
/** The invoice's captured, unrefunded platform-fee payment as a stored fee period, or null. */
function capturedFee(invoice, payment, amount) {
  if (payment.id !== invoice.payment_id || payment.invoice_id !== invoice.id || payment.status !== 'captured'
    || payment.amount !== amount || payment.currency !== 'INR' || payment.refund_status) return null
  return { invoiceId: invoice.id, paymentId: payment.id, amountMinor: amount, currency: 'INR', periodStart: iso(invoice.billing_start), periodEnd: iso(invoice.billing_end) }
}

/**
 * Rereads the attempt's Test subscription, plan, invoices and payments and derives only what they
 * prove. Browser values never enter this decision; a token authorisation is not the platform fee.
 */
async function readProviderOutcome(client, { attempt, vendorId, planId }) {
  const subscription = await client.fetchSubscription(attempt.associationId)
  if (subscription.id !== attempt.associationId || subscription.plan_id !== planId || subscription.quantity !== 1
    || subscription.notes?.md_attempt !== attempt.attemptId || subscription.notes?.md_vendor !== vendorId) {
    return { state: 'needs_verification', problem: 'ownership', fee: null }
  }
  if (subscription.status === 'created') return null
  const plan = await client.fetchPlan(planId)
  const amount = attempt.expected?.amountMinor
  if (plan.id !== planId || plan.period !== 'monthly' || plan.interval !== 1 || plan.item?.currency !== 'INR'
    || amount !== platformFeeMinor || plan.item?.amount !== amount) {
    return { state: 'needs_verification', problem: 'plan', fee: null }
  }
  const expectedStart = attempt.expectedChargeAt ? seconds(attempt.expectedChargeAt) : null
  if (expectedStart !== null && subscription.start_at !== expectedStart) return { state: 'needs_verification', problem: 'schedule', fee: null }

  const { items = [] } = await client.listInvoices({ subscriptionId: subscription.id })
  // Invoices for other amounts, such as a refundable card token charge, are not the monthly fee.
  // Only the first monthly invoice is the first fee; a later paid cycle cannot stand in for it.
  const [invoice] = items.filter((item) => monthlyInvoice(item, subscription.id, amount)).sort((a, b) => a.billing_start - b.billing_start)
  let fee = null
  if (invoice?.status === 'paid' && invoice.payment_id) {
    const earliestStart = expectedStart ?? (attempt.requestedAt ? seconds(attempt.requestedAt) - 300 : null)
    if (!Number.isSafeInteger(invoice.billing_start) || !coversOneMonth(invoice)
      || (expectedStart !== null ? invoice.billing_start !== expectedStart : earliestStart === null || invoice.billing_start < earliestStart)) {
      return { state: 'needs_verification', problem: 'period', fee: null }
    }
    fee = capturedFee(invoice, await client.fetchPayment(invoice.payment_id), amount)
  }
  if (fee) return { state: 'fee_confirmed', problem: null, fee, ...await readRenewals(client, { subscription, invoices: items, attempt: { ...attempt, fee } }) }
  const state = authorisedStatuses.includes(subscription.status) ? 'authorised' : closedStatuses.includes(subscription.status) ? 'provider_closed' : 'provider_pending'
  // The status tells a first fee still being retried (`pending`) from halted or paused collection.
  return { state, problem: null, fee: null, providerStatus: subscription.status }
}

/**
 * Extends confirmed coverage only along the original cycle chain: each renewal is a paid, captured
 * ₹299 invoice starting exactly where the last confirmed period ended. A retry settles that same
 * cycle, so neither its payment time nor a Test Dashboard acceleration starts a new month. Counted
 * renewals are append-only and a latest-due failure never reverts to pending, so repeated, stale or
 * out-of-order reads cannot count a fee twice or roll status back.
 */
async function readRenewals(client, { subscription, invoices, attempt }) {
  const renewals = [...(attempt.renewals ?? [])]
  const counted = new Set([attempt.fee.invoiceId, ...renewals.map((item) => item.invoiceId)])
  const monthly = invoices.filter((item) => monthlyInvoice(item, subscription.id, platformFeeMinor))
  const dueAt = () => (renewals.at(-1) ?? attempt.fee).periodEnd
  for (;;) {
    const start = seconds(dueAt())
    const invoice = monthly.find((item) => item.billing_start === start && item.status === 'paid' && item.payment_id)
    const renewed = invoice && coversOneMonth(invoice) ? capturedFee(invoice, await client.fetchPayment(invoice.payment_id), platformFeeMinor) : null
    if (!renewed) break
    renewals.push(renewed)
    counted.add(invoice.id)
  }
  const due = dueAt()
  const open = monthly.some((item) => !counted.has(item.id) && item.billing_start === seconds(due))
  // Only halted collection has failed; a declined attempt Razorpay is retrying (`pending`) is still pending.
  const observed = open ? (subscription.status === 'halted' ? 'failed' : 'pending') : null
  const prior = attempt.renewal?.dueAt === due ? attempt.renewal : null
  // A paid charge that is not the next original cycle, such as a duplicate or a period starting at charge time, is never coverage.
  const uncounted = monthly.some((item) => !counted.has(item.id) && item.status === 'paid' && item.billing_start !== seconds(due))
  // A failure recorded before halted-only failures (a retrying read) re-derives while Razorpay still retries.
  const status = prior?.status === 'failed' && subscription.status !== 'pending' ? 'failed' : observed ?? prior?.status ?? null
  const problem = uncounted || prior?.problem ? 'uncounted' : null
  return {
    renewals,
    renewal: status || problem ? { dueAt: due, status, problem } : null,
    providerStatus: subscription.status,
  }
}

/** Rereads a confirmed fee's subscription for renewals and closure; the first fee itself is never rederived. */
async function readRenewalOutcome(client, { attempt }) {
  const subscription = await client.fetchSubscription(attempt.associationId)
  if (subscription.id !== attempt.associationId) throw new ProviderError('Razorpay Test returned another subscription.', false)
  const { items = [] } = await client.listInvoices({ subscriptionId: subscription.id })
  return { state: 'fee_confirmed', problem: null, fee: attempt.fee, ...await readRenewals(client, { subscription, invoices: items, attempt }) }
}

/**
 * A helper cancellation is confirmed only by a read showing its object closed, effective no later than
 * that read; a later stale active read never reopens it because closed objects are not reread.
 */
function reconcileCancellation(attempt, readAt) {
  const { cancellation } = attempt
  if (!cancellation || !openCancellationStates.includes(cancellation.state) || !collectionEnded(attempt)) return attempt
  const scheduled = cancellation.state === 'scheduled' && cancellation.effectiveAt
  const effectiveAt = scheduled && Date.parse(cancellation.effectiveAt) < Date.parse(readAt) ? cancellation.effectiveAt : readAt
  return { ...attempt, cancellation: { ...cancellation, state: 'confirmed', effectiveAt } }
}

/** Checks the inspected provider object against the scenario before Checkout may open it. */
function inspectionProblem({ subscription, plan, attempt, vendorId, planId }) {
  if (!ownedBy(subscription, { attempt, vendorId, planId })) {
    return { state: 'needs_verification', error: 'The recorded Test subscription does not belong to this vendor attempt. No replacement is created.' }
  }
  if (plan.id !== planId || plan.period !== 'monthly' || plan.interval !== 1 || plan.item?.currency !== 'INR'
    || !Number.isSafeInteger(plan.item?.amount) || plan.item.amount <= 0 || subscription.quantity !== 1) {
    return { state: 'schedule_mismatch', error: 'The Test subscription is not on the supplied monthly INR plan. Checkout is blocked.' }
  }
  if (subscription.status !== 'created' || subscription.paid_count) {
    return { state: 'needs_verification', error: 'The recorded Test subscription is no longer fresh. Its outcome needs provider verification; no replacement is created.' }
  }
  const expectedStart = attempt.expectedChargeAt ? seconds(attempt.expectedChargeAt) : null
  if ((subscription.start_at ?? null) !== expectedStart) {
    return { state: 'schedule_mismatch', error: 'The Test subscription start differs from the original trial expiry or paid-through date. Checkout is blocked; the boundary is not moved.' }
  }
  return null
}

function requireTestConfig(config) {
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(config.keyId ?? '') || !config.secret || typeof config.secret !== 'string') {
    throw new Error('Set local RAZORPAY_TEST_KEY_ID and RAZORPAY_TEST_KEY_SECRET; only rzp_test_ keys are accepted.')
  }
  if (/rzp_live_|live/i.test(config.secret)) throw new Error('Live provider configuration is refused.')
}

function readStore(file) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    if (data.version !== 1 || !data.vendors || typeof data.vendors !== 'object') throw new Error('Unknown local helper store format.')
    return { version: 1, vendors: Object.assign(Object.create(null), data.vendors), history: Object.assign(Object.create(null), data.history) }
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, vendors: Object.create(null), history: Object.create(null) }
    throw error
  }
}

function saveStore(file, store) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.tmp`
  const descriptor = openSync(temporary, 'w', 0o600)
  try { writeFileSync(descriptor, JSON.stringify(store, null, 2)); fsyncSync(descriptor); closeSync(descriptor); renameSync(temporary, file) }
  catch (error) { try { closeSync(descriptor) } catch { /* already closed */ }; try { unlinkSync(temporary) } catch { /* no temporary file */ }; throw error }
}

function publicRecord(record) {
  return record ? structuredClone(record) : null
}

/** Records saved before reset existed are their vendor's first generation. */
const generationOf = (record) => record.generation ?? 1
const period = (fee) => fee && { amountMinor: fee.amountMinor, currency: fee.currency, periodStart: fee.periodStart, periodEnd: fee.periodEnd }

/** What history keeps of an attempt: dates, provider association and observed outcomes, never keys or payment identifiers. */
function scrubAttempt(attempt) {
  return {
    attemptId: attempt.attemptId ?? null, action: attempt.action, state: attempt.state, associationId: attempt.associationId ?? null,
    requestedAt: attempt.requestedAt ?? null, expectedChargeAt: attempt.expectedChargeAt ?? null, problem: attempt.problem ?? null,
    providerStatus: attempt.providerStatus ?? null, fee: period(attempt.fee) ?? null, renewals: (attempt.renewals ?? []).map(period),
    renewal: attempt.renewal ? { dueAt: attempt.renewal.dueAt, status: attempt.renewal.status } : null,
    cancellation: attempt.cancellation ? { state: attempt.cancellation.state, mode: attempt.cancellation.mode, requestedAt: attempt.cancellation.requestedAt, effectiveAt: attempt.cancellation.effectiveAt ?? null } : null,
  }
}

/** The idempotency keys a generation used; they are kept only to refuse late replays and never shown. */
const usedKeys = (record) => [
  ...record.attempts.flatMap((attempt) => [attempt.idempotencyKey, attempt.cancellation?.idempotencyKey]),
  record.reset?.idempotencyKey,
  record.stoppedBy,
].filter(Boolean)

const publicHistory = (entries = []) => entries.map(({ retiredKeys, ...entry }) => structuredClone(entry))

function response(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(body))
}

async function requestBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 2048) throw new Error('Request is too large.')
  }
  return JSON.parse(body || '{}')
}

/** Local-only HTTP boundary. Provider calls happen only after durable intent exists. */
export function createVendorBillingTestHelper({ file, keyId, secret, planId, now = () => new Date(), provider }) {
  requireTestConfig({ keyId, secret })
  if (!/^plan_[A-Za-z0-9]+$/.test(planId ?? '')) throw new Error('Set local RAZORPAY_TEST_PLAN_ID to the supplied monthly Test plan.')
  const client = provider ?? createRazorpayTestProvider({ keyId, secret })
  const store = readStore(file)
  const busyVendors = new Set()
  /** One provider read per vendor at a time; simultaneous status reads share its result. */
  const statusReads = new Map()
  /** `providerCheck` reports whether this read reached the provider; a failed read keeps recorded results. */
  const view = (record, providerCheck = 'not_checked') => ({ ...publicRecord(record), serverTime: now().toISOString(), ...currentStatus(record, now()), providerCheck })

  /** Persists before returning; a failed write restores the previous record. */
  function commit(vendorId, record, changes) {
    const next = { ...record, ...changes, revision: record.revision + 1 }
    store.vendors[vendorId] = next
    try { saveStore(file, store) } catch (error) { store.vendors[vendorId] = record; throw error }
    return next
  }

  /** A key used by a reset generation belongs to that history; replaying it never reaches the current generation. */
  const retired = (vendorId, key) => (store.history[vendorId] ?? []).some((entry) => entry.retiredKeys.includes(key))
  const retiredReply = [409, { error: 'This request belongs to an earlier, reset Test scenario. Nothing was changed; refresh Plan.' }]
  const resetPendingReply = [409, { error: 'A Test scenario reset is pending for this vendor. Retry the reset; no new Checkout or cancellation starts meanwhile.' }]

  async function prepare(vendorId, { action, idempotencyKey }) {
    if (!['setup_autopay', 'pay_first_fee'].includes(action) || typeof idempotencyKey !== 'string' || !keyPattern.test(idempotencyKey)) {
      return [400, { error: 'A valid billing action and idempotency key are required.' }]
    }
    if (retired(vendorId, idempotencyKey)) return retiredReply
    let record = store.vendors[vendorId]
    if (!record) return [409, { error: 'Select a scenario first.' }]
    if (record.reset) return resetPendingReply
    const keyed = record.attempts.findLast((item) => item.idempotencyKey === idempotencyKey)
    if (keyed && keyed.action !== action) return [409, { error: 'The idempotency key belongs to another action.' }]
    // One logical preparation per scenario action: a key minted after a reload converges on it. An object
    // Razorpay shows closed is history, so rejoining, even under the page's earlier key, prepares a new one.
    let attempt = (keyed && !collectionEnded(keyed) ? keyed : null) ?? record.attempts.find((item) => item.action === action && !collectionEnded(item))
    if (attempt && settledStates.includes(attempt.state)) {
      return [409, { error: unresolvedStates.includes(attempt.state)
        ? 'This Test subscription already has an unverified outcome. No replacement is created; refresh billing status.'
        : 'This Test subscription already has a provider outcome. No replacement is created; refresh billing status.' }]
    }
    const derived = currentStatus(record, now())
    if (!derived.availableActions.includes(action)) {
      return [409, { error: 'This billing action is not available for the current Test scenario. Refresh billing status.' }]
    }
    const save = (changes) => {
      const next = { ...attempt, ...changes }
      record = commit(vendorId, record, { attempts: replaceAttempt(record, attempt, next) })
      attempt = next
    }
    // AutoPay starts at the retained boundary: the paid sample's anchor or verified paid-through date, otherwise
    // the original trial expiry. A rejoin keeps that same boundary, so no fee is taken twice.
    const expectedChargeAt = action === 'setup_autopay' ? derived.paidThrough ?? record.trialEndsAt : null
    for (const stopped of record.attempts.filter((item) => stopToClose(record, item))) {
      const closing = await closeStoppedAgreement(vendorId, record, stopped)
      record = closing.record
      if (closing.reply) return closing.reply
    }
    if (!attempt) {
      attempt = { action, idempotencyKey, state: 'intent_recorded', associationId: null }
      record = commit(vendorId, record, { attempts: [...record.attempts, attempt] })
    }
    if (!attempt.attemptId) save({ attemptId: `lt_${randomUUID().replaceAll('-', '')}`, scenario: record.scenario, expectedChargeAt })

    if (!attempt.associationId) {
      let subscription = null
      if (attempt.state === 'provider_requested') {
        subscription = await findTaggedSubscription(client, { planId, attempt })
        // A timed-out create can still commit late, so a recent miss is not proof of absence.
        if (!subscription && now().getTime() - Date.parse(attempt.requestedAt) < uncertainCreationWindowMs) {
          return [504, { error: 'The earlier Razorpay Test request is still uncertain and not visible yet. Refresh billing status later; no second subscription is created.' }]
        }
      }
      if (!subscription) {
        save({ state: 'provider_requested', requestedAt: now().toISOString() })
        try {
          subscription = await client.createSubscription({
            plan_id: planId, total_count: 12, quantity: 1, customer_notify: false,
            ...(attempt.expectedChargeAt ? { start_at: seconds(attempt.expectedChargeAt) } : {}),
            notes: { md_attempt: attempt.attemptId, md_vendor: vendorId, md_scenario: record.scenario },
          })
        } catch (error) {
          if (error instanceof ProviderError && error.definite) save({ state: 'creation_rejected' })
          throw error
        }
      }
      if (record.associations.some((association) => association.id === subscription.id)) {
        return [409, { error: 'This Test subscription is already associated with another attempt.' }]
      }
      const next = { ...attempt, associationId: subscription.id, state: 'association_unverified' }
      record = commit(vendorId, record, {
        attempts: replaceAttempt(record, attempt, next),
        associations: [...record.associations, { id: subscription.id, state: 'unverified', attemptId: attempt.attemptId, action }],
      })
      attempt = next
    }

    const [subscription, plan] = await Promise.all([client.fetchSubscription(attempt.associationId), client.fetchPlan(planId)])
    const problem = inspectionProblem({ subscription, plan, attempt, vendorId, planId })
    if (problem) {
      save({ state: problem.state })
      return [409, { error: problem.error }]
    }
    // Inspection matched start_at at Razorpay's whole-second precision, so quote the original boundary.
    const expected = { amountMinor: plan.item.amount, currency: 'INR', chargeAt: attempt.expectedChargeAt, authorisationAmountMinor: null }
    if (JSON.stringify(attempt.expected) !== JSON.stringify(expected)) save({ expected })
    const lifetimeEnd = now().getTime() + preparationLifetimeMs
    return [200, {
      attempt: {
        attemptId: attempt.attemptId, vendorId, action, mode: 'provider', expected,
        config: { keyId, subscriptionId: attempt.associationId, name: 'MithraDirect', description: 'Vendor platform membership · local Razorpay Test Mode' },
        expiresAt: new Date(expected.chargeAt ? Math.min(lifetimeEnd, Date.parse(expected.chargeAt)) : lifetimeEnd).toISOString(),
      },
      record: view(record),
    }]
  }

  /**
   * Verifies the Checkout signature against the subscription this helper recorded, then records only
   * that an authentic callback arrived. The payment ID and signature are neither stored nor logged.
   */
  function submit(vendorId, { attemptId, subscriptionId, paymentId, signature }) {
    if (typeof attemptId !== 'string' || typeof subscriptionId !== 'string' || !/^pay_[A-Za-z0-9]{1,40}$/.test(paymentId ?? '')
      || !/^[a-f0-9]{64}$/.test(signature ?? '')) {
      return [400, { error: 'Checkout returned incomplete details. Nothing was recorded; refresh billing status.' }]
    }
    const record = store.vendors[vendorId]
    const attempt = record?.attempts.find((item) => item.attemptId === attemptId)
    if (!attempt?.associationId || attempt.associationId !== subscriptionId) {
      return [409, { error: 'Checkout returned details for another Test attempt. Nothing was recorded; refresh billing status.' }]
    }
    const expected = createHmac('sha256', secret).update(`${paymentId}|${attempt.associationId}`).digest()
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
      return [400, { error: 'The Checkout callback failed Razorpay Test signature verification. Nothing was recorded; refresh billing status.' }]
    }
    // A duplicate or late callback never moves an attempt that already has a provider result.
    if (!['association_unverified', 'callback_unverified'].includes(attempt.state)) return [200, { record: view(record) }]
    const next = commit(vendorId, record, { attempts: replaceAttempt(record, attempt, { ...attempt, state: 'callback_verified' }) })
    return [200, { record: view(next) }]
  }

  /**
   * Keep shop open never lets two agreements collect at the same boundary: the stopped agreement is closed
   * now, with the request recorded first, and only a read showing it closed lets the replacement be created.
   * Its paid coverage is the helper's record of the confirmed fee, so closing it early loses no paid days.
   */
  async function closeStoppedAgreement(vendorId, record, attempt) {
    let subscription
    try {
      subscription = await client.fetchSubscription(attempt.associationId)
      if (!ownedBy(subscription, { attempt, vendorId, planId })) {
        return { record, reply: [409, { error: 'The stopped plan\'s Test subscription does not belong to this vendor attempt. No replacement is created.' }] }
      }
      if (!closedStatuses.includes(subscription.status)) {
        const requested = { ...attempt, cancellation: { ...attempt.cancellation, closeRequestedAt: attempt.cancellation.closeRequestedAt ?? now().toISOString() } }
        record = commit(vendorId, record, { attempts: replaceAttempt(record, attempt, requested) })
        attempt = requested
        await client.cancelSubscription(attempt.associationId, { cancelAtCycleEnd: false })
        subscription = await client.fetchSubscription(attempt.associationId)
      }
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      return { record, reply: [error.definite ? 502 : 504, { error: `${error.definite ? error.message : 'Razorpay Test did not respond'}. The stopped plan's subscription is not confirmed closed, so no new one was created. Try again in a moment.` }] }
    }
    if (subscription.id !== attempt.associationId || !closedStatuses.includes(subscription.status)) {
      return { record, reply: [504, { error: 'Razorpay Test has not yet shown the stopped plan\'s subscription closed, so no new one was created. Try again in a moment.' }] }
    }
    const closed = reconcileCancellation({ ...attempt, providerStatus: subscription.status, verifiedAt: now().toISOString() }, now().toISOString())
    return { record: commit(vendorId, record, { attempts: replaceAttempt(record, attempt, closed) }) }
  }

  /**
   * Records the vendor's cancellation against the current helper-created agreement before asking Razorpay
   * Test to stop it. Its acceptance is a request or a scheduled stop only; a later status read confirms it.
   */
  async function cancel(vendorId, { idempotencyKey }) {
    if (typeof idempotencyKey !== 'string' || !keyPattern.test(idempotencyKey)) return [400, { error: 'A valid idempotency key is required.' }]
    if (retired(vendorId, idempotencyKey)) return retiredReply
    let record = store.vendors[vendorId]
    if (!record) return [409, { error: 'Select a scenario first.' }]
    if (record.reset) return resetPendingReply
    if (record.stoppedBy === idempotencyKey) return [200, { record: view(record) }]
    // A key belongs to one agreement's cancellation; replaying it after a rejoin never touches the replacement.
    if (record.attempts.some((item) => item.cancellation?.idempotencyKey === idempotencyKey && item !== record.attempts.findLast(hasObject))) {
      return [200, { record: view(record) }]
    }
    let attempt = record.attempts.findLast(hasObject)
    // One logical cancellation per agreement: a replayed or reloaded key converges on its recorded progress.
    if (attempt?.cancellation && !['requested', 'failed'].includes(attempt.cancellation.state)) return [200, { record: view(record) }]
    const derived = currentStatus(record, now())
    if (!derived.availableActions.includes('cancel')) {
      return [409, { error: 'There is no Test AutoPay agreement to cancel for this scenario. Refresh billing status.' }]
    }
    if (!attempt) {
      record = commit(vendorId, record, { stoppedBy: idempotencyKey, ...planStopped(record, derived.paidThrough, now().toISOString()) })
      return [200, { record: view(record) }]
    }
    let subscription
    try { subscription = await client.fetchSubscription(attempt.associationId) } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      return [error.definite ? 502 : 504, { error: 'Razorpay Test could not be read, so nothing was cancelled. Refresh billing status and try again.' }]
    }
    if (!ownedBy(subscription, { attempt, vendorId, planId })) {
      return [409, { error: 'The recorded Test subscription does not belong to this vendor attempt. Nothing was cancelled.' }]
    }
    // A paid cycle in progress stops at its end; before the first fee, or once paid coverage has lapsed, the stop is immediate.
    const paidCycle = attempt.state === 'fee_confirmed' && now().getTime() < Date.parse(derived.paidThrough)
    const mode = attempt.cancellation?.mode ?? (paidCycle ? 'cycle_end' : 'immediate')
    const retried = attempt.cancellation?.state === 'requested'
    const save = (changes) => {
      const next = { ...attempt, cancellation: { ...attempt.cancellation, ...changes } }
      // Razorpay Test accepting a cycle-end stop moves the prototype's Paid to Stopped; an immediate one waits for a read.
      const stop = record.events && record.scenario === 'paid' && stopAcceptedStates.includes(next.cancellation.state) ? planStopped(record, derived.paidThrough, now().toISOString()) : {}
      record = commit(vendorId, record, { attempts: replaceAttempt(record, attempt, next), ...stop })
      attempt = next
    }
    save({
      idempotencyKey: attempt.cancellation?.idempotencyKey ?? idempotencyKey, associationId: attempt.associationId, mode,
      state: 'requested', requestedAt: attempt.cancellation?.requestedAt ?? now().toISOString(), effectiveAt: null,
    })
    // An earlier unanswered request may already have landed: the status read confirms it without asking again.
    if (closedStatuses.includes(subscription.status)) return [200, { record: view(record) }]
    try {
      await client.cancelSubscription(attempt.associationId, { cancelAtCycleEnd: mode === 'cycle_end' })
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      if (!error.definite) {
        return [504, { error: 'The Razorpay Test cancellation outcome is uncertain, so future collection is not shown as stopped. Refresh billing status to reconcile it.' }]
      }
      // After an unanswered request, a refusal may mean the earlier stop already landed, so it stays uncertain.
      if (retried) return [504, { error: 'Razorpay Test refused a repeated cancellation request, so the earlier one may already have landed. Future collection is not shown as stopped; refresh billing status.' }]
      save({ state: 'failed' })
      return [502, { error: `${error.message}. Future collection has not been stopped.` }]
    }
    save(mode === 'cycle_end' ? { state: 'scheduled', effectiveAt: derived.paidThrough } : { state: 'acknowledged' })
    return [200, { record: view(record) }]
  }

  /**
   * Settles one recorded object for reset. Only a read showing it closed settles it; an unread, unowned or
   * unconfirmed object stays unresolved. Each cancellation request is persisted before Razorpay is asked.
   */
  async function settleForReset(vendorId, attempt, entry, save) {
    // Razorpay has already shown this object closed, and a closed subscription never restarts.
    if (collectionEnded(attempt)) return save({ outcome: entry.cancellationRequestedAt ? 'cancelled_by_reset' : 'closed', providerStatus: attempt.providerStatus ?? entry.providerStatus })
    let { associationId } = entry
    let subscription
    try {
      if (associationId) subscription = await client.fetchSubscription(associationId)
      else {
        // A creation whose response was lost is found by its attempt tag.
        subscription = await findTaggedSubscription(client, { planId, attempt })
        if (!subscription) {
          // A timed-out create can still commit late, so a recent miss is not proof of absence.
          return save({ outcome: now().getTime() - Date.parse(attempt.requestedAt) < uncertainCreationWindowMs ? 'creation_uncertain' : 'never_created' })
        }
        associationId = subscription.id
      }
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      return save({ outcome: 'read_failed' })
    }
    // Only an object this helper created for this vendor attempt is within reset's reach.
    if (!attempt.attemptId || !ownedBy(subscription, { attempt: { ...attempt, associationId }, vendorId, planId })) {
      return save({ associationId, outcome: 'not_owned', providerStatus: null })
    }
    if (closedStatuses.includes(subscription.status)) {
      return save({ associationId, outcome: entry.cancellationRequestedAt ? 'cancelled_by_reset' : 'closed', providerStatus: subscription.status })
    }
    const retried = Boolean(entry.cancellationRequestedAt)
    save({ associationId, outcome: 'cancel_requested', providerStatus: subscription.status, cancellationRequestedAt: entry.cancellationRequestedAt ?? now().toISOString() })
    // A reset stops collection now, including a paid cycle or a scheduled cycle-end stop.
    try { await client.cancelSubscription(associationId, { cancelAtCycleEnd: false }) } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      // An unanswered request may still land; after one, a refusal may mean the earlier stop already did.
      return save(!error.definite || retried ? { outcome: 'cancel_requested' } : { outcome: 'cancel_rejected', cancellationRequestedAt: null })
    }
    // Acceptance is only a request: a read showing the object closed confirms it.
    let after = null
    try { after = await client.fetchSubscription(associationId) } catch (error) { if (!(error instanceof ProviderError)) throw error }
    return save(after?.id === associationId && closedStatuses.includes(after.status)
      ? { outcome: 'cancelled_by_reset', providerStatus: after.status } : { outcome: 'cancel_acknowledged' })
  }

  /**
   * Reconciles every provider object recorded for the vendor's current generation, then retires it to a
   * scrubbed history. Any unsettled object keeps the reset pending, and a retry converges on the same reset.
   * The vendor then has no scenario until the operator explicitly selects a fresh generation.
   */
  async function reset(vendorId, { scenario, generation, idempotencyKey }) {
    if (!scenarios.includes(scenario) || !Number.isSafeInteger(generation) || typeof idempotencyKey !== 'string' || !keyPattern.test(idempotencyKey)) {
      return [400, { error: 'Confirm the Test scenario and generation to reset.' }]
    }
    let record = store.vendors[vendorId]
    const history = store.history[vendorId] ?? []
    const reply = () => [200, { record: record ? view(record) : null, history: publicHistory(store.history[vendorId]) }]
    if (!record || record.scenario !== scenario || generationOf(record) !== generation) {
      // Repeating a completed reset's confirmation converges on it and never touches a newer generation.
      if (history.some((entry) => entry.generation === generation && entry.scenario === scenario)) return reply()
      return [409, { error: 'This reset confirmation names another Test scenario for this vendor. Nothing was reset; refresh Plan and confirm again.' }]
    }
    if (!record.reset) record = commit(vendorId, record, { reset: { state: 'pending', idempotencyKey, requestedAt: now().toISOString(), objects: [] } })
    for (const attempt of record.attempts.filter(hasObject)) {
      let entry = record.reset.objects.find((item) => attempt.attemptId ? item.attemptId === attempt.attemptId : item.associationId === attempt.associationId)
        ?? { attemptId: attempt.attemptId ?? null, associationId: attempt.associationId ?? null, action: attempt.action, outcome: null, providerStatus: null, cancellationRequestedAt: null }
      if (resetTerminalOutcomes.includes(entry.outcome)) continue
      const save = (changes) => {
        const next = { ...entry, ...changes }
        const objects = record.reset.objects.includes(entry) ? record.reset.objects.map((item) => item === entry ? next : item) : [...record.reset.objects, next]
        record = commit(vendorId, record, { reset: { ...record.reset, objects } })
        entry = next
      }
      await settleForReset(vendorId, attempt, entry, save)
    }
    if (!record.reset.objects.every((item) => resetTerminalOutcomes.includes(item.outcome))) return reply()
    const retiring = record
    store.history[vendorId] = [...history, {
      generation, scenario, selectedAt: retiring.selectedAt ?? retiring.serverTime, trialEndsAt: retiring.trialEndsAt,
      paidThrough: samplePaidScenarios.includes(scenario) ? retiring.paidThrough : null,
      resetRequestedAt: retiring.reset.requestedAt, resetCompletedAt: now().toISOString(),
      attempts: retiring.attempts.map(scrubAttempt), objects: retiring.reset.objects, retiredKeys: usedKeys(retiring),
    }]
    delete store.vendors[vendorId]
    try { saveStore(file, store) } catch (error) { store.vendors[vendorId] = retiring; store.history[vendorId] = history; throw error }
    record = null
    return reply()
  }

  /**
   * The prototype's Paid, stopped: paid days are kept and AutoPay is shown cancelled. `autopay_ended` records a
   * stop that came from outside Plan, such as the card issuer revoking the mandate.
   */
  function planStopped(record, paidThrough, at, kind = 'plan_stopped', reason = null) {
    return { scenario: 'stopped', paidThrough, autoPay: 'cancelled', events: [...record.events, { kind, at, paidThrough, ...(reason ? { reason } : {}) }] }
  }

  /**
   * Prototype changes a provider read has just confirmed: trial AutoPay history rows; a ₹299 paid now in
   * Payment failed or Shop closed moving the scenario to Paid over the provider's invoice period; Keep shop
   * open's AutoPay moving Stopped back to Paid with the same paid-through; and a confirmed stop of Paid, or Razorpay
   * closing Paid's agreement from outside, moving it to Stopped.
   */
  function prototypeChanges(record, before, after, at) {
    // Razorpay halted a scheduled fee after its boundary: the retries are used up, so the shop is hidden. A halt before
    // the boundary keeps the covered days; the helper's cancellation then ends AutoPay as below.
    if (after.haltedAt && !before.haltedAt && ['paid', ...trialScenarios].includes(record.scenario)
      && now().getTime() >= Date.parse(currentStatus(record, now()).paidThrough ?? record.trialEndsAt)) {
      return { scenario: 'payment_failed', autoPay: 'none', failedPaymentAt: at, events: [...record.events, { kind: 'payment_failed', at }] }
    }
    if (record.scenario === 'stopped' && after.action === 'setup_autopay' && after.state === 'authorised' && before.state !== 'authorised') {
      return { scenario: 'paid', autoPay: 'on', events: [...record.events, { kind: 'plan_resumed', at, chargeAt: after.expectedChargeAt }] }
    }
    if (record.scenario === 'paid' && after.cancellation?.reason !== 'halted'
      && stopAcceptedStates.includes(after.cancellation?.state) && !stopAcceptedStates.includes(before.cancellation?.state)) {
      return planStopped(record, currentStatus(record, now()).paidThrough, at)
    }
    // Paid's agreement closed without Stop the plan, from outside or by the helper after a halt, so nothing more is
    // charged: Stopped keeps the paid days and offers Keep shop open, which Paid has no button for.
    if (record.scenario === 'paid' && collectionEnded(after) && !collectionEnded(before) && after.attemptId === record.attempts.findLast(hasObject)?.attemptId) {
      return planStopped(record, currentStatus(record, now()).paidThrough, at, 'autopay_ended', after.haltedAt ? 'halted' : null)
    }
    const events = [...record.events, ...(trialScenarios.includes(record.scenario) ? autoPayEvents(before, after, at) : [])]
    if (!payNowScenarios.includes(record.scenario) || after.action !== 'pay_first_fee' || after.state !== 'fee_confirmed' || before.state === 'fee_confirmed') return { events: [...events, ...paidEvents(before, after, at)] }
    const { amountMinor, periodStart, periodEnd } = after.fee
    return { scenario: 'paid', paidThrough: periodEnd, autoPay: 'on', failedPaymentAt: null, events: [...events, { kind: 'paid', at: periodStart, amountMinor, paidThrough: periodEnd }] }
  }

  /**
   * "Paid ₹299" rows for fees a provider read has just confirmed outside Pay ₹299: a trial AutoPay fee Razorpay
   * collected, and each renewal along the paid cycle. They are dated at the read, since a cycle can start later.
   */
  function paidEvents(before, after, at) {
    if (after.state !== 'fee_confirmed') return []
    const fees = [...(before.state === 'fee_confirmed' ? [] : [after.fee]), ...(after.renewals ?? []).slice(before.renewals?.length ?? 0)]
    return fees.map(({ amountMinor, periodEnd }) => ({ kind: 'paid', at, amountMinor, paidThrough: periodEnd }))
  }

  /** Prototype history rows for an AutoPay change a provider read has just confirmed. */
  function autoPayEvents(before, after, at) {
    if (after.action !== 'setup_autopay') return []
    if (after.state === 'authorised' && before.state !== 'authorised') return [{ kind: 'autopay_on', at, chargeAt: after.expectedChargeAt }]
    if ((before.state === 'authorised' || before.haltedAt) && after.state === 'provider_closed') return [{ kind: 'autopay_off', at: after.cancellation?.effectiveAt ?? at }]
    return []
  }

  /** Rereads associated provider records; only a changed derived result is persisted. */
  async function readProvider(vendorId) {
    let record = store.vendors[vendorId]
    // A confirmed fee is reread for renewals until its subscription closes; problems and closed objects stay final.
    const due = record.attempts.filter((attempt) => attempt.associationId && !attempt.problem
      && (readbackStates.includes(attempt.state) || (attempt.state === 'fee_confirmed' && !closedStatuses.includes(attempt.providerStatus))))
    if (!due.length) return view(record)
    let check = 'current'
    for (const attempt of due) {
      let outcome
      try {
        outcome = attempt.state === 'fee_confirmed' ? await readRenewalOutcome(client, { attempt })
          : await readProviderOutcome(client, { attempt, vendorId, planId })
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error
        check = 'unavailable'
        continue
      }
      // Halted collection is a failed platform fee, recorded once; the object is cancelled below.
      const read = { ...attempt, ...outcome, ...(outcome?.providerStatus === 'halted' && !attempt.haltedAt ? { haltedAt: now().toISOString() } : {}) }
      const next = reconcileCancellation(read, now().toISOString())
      if (next === read && (!outcome || Object.entries(outcome).every(([key, value]) => JSON.stringify(value ?? null) === JSON.stringify(attempt[key] ?? null)))) continue
      // Only prototype scenarios carry seeded history; others gain none.
      const prototypePatch = record.events ? prototypeChanges(record, attempt, next, now().toISOString()) : {}
      record = commit(vendorId, record, { attempts: replaceAttempt(record, attempt, { ...next, verifiedAt: now().toISOString() }), ...prototypePatch })
    }
    for (const attempt of record.reset ? [] : record.attempts.filter(haltedUncancelled)) {
      if (!await cancelHalted(vendorId, attempt)) check = 'unavailable'
      record = store.vendors[vendorId]
    }
    return view(record, check)
  }

  /**
   * Razorpay halted collection after every retry, so the fee has failed. The helper cancels the halted object
   * now, so nothing can charge the vendor later; the request is recorded first, and a later read confirms it.
   * Returns false when Razorpay Test could not be asked, leaving the request for the next read to retry.
   */
  async function cancelHalted(vendorId, attempt) {
    const record = store.vendors[vendorId]
    const requested = { ...attempt, cancellation: {
      idempotencyKey: attempt.cancellation?.idempotencyKey ?? `halted_${attempt.attemptId}`, associationId: attempt.associationId, mode: 'immediate', reason: 'halted',
      state: 'requested', requestedAt: attempt.cancellation?.requestedAt ?? now().toISOString(), effectiveAt: null,
    } }
    commit(vendorId, record, { attempts: replaceAttempt(record, attempt, requested) })
    try {
      await client.cancelSubscription(attempt.associationId, { cancelAtCycleEnd: false })
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      return false
    }
    const accepted = store.vendors[vendorId]
    commit(vendorId, accepted, { attempts: replaceAttempt(accepted, requested, { ...requested, cancellation: { ...requested.cancellation, state: 'acknowledged' } }) })
    return true
  }

  return createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && (req.headers['content-type'] !== 'application/json'
        || (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)))) {
        return response(res, 403, { error: 'Local helper writes require the local development app.' })
      }
      const path = new URL(req.url, 'http://localhost').pathname
      const match = /^\/vendors\/([^/]+)\/(scenario|status|intents|associations|preparations|submissions|cancellations|resets)$/.exec(path)
      if (!match || !vendorPattern.test(match[1])) return response(res, 404, { error: 'Unknown local helper route.' })
      const [, vendorId, operation] = match
      if (req.method === 'GET' && operation === 'status') {
        const record = store.vendors[vendorId]
        const history = publicHistory(store.history[vendorId])
        if (!record) return response(res, 200, { record: null, history })
        if (statusReads.has(vendorId)) return response(res, 200, { record: await statusReads.get(vendorId), history })
        // A read during a write returns the recorded state, marked as not freshly checked.
        if (busyVendors.has(vendorId)) return response(res, 200, { record: view(record, 'deferred'), history })
        busyVendors.add(vendorId)
        const read = readProvider(vendorId)
        statusReads.set(vendorId, read)
        try { return response(res, 200, { record: await read, history }) } finally { busyVendors.delete(vendorId); statusReads.delete(vendorId) }
      }
      if (req.method === 'POST' && ['preparations', 'submissions', 'cancellations', 'resets'].includes(operation)) {
        const body = await requestBody(req)
        // Concurrent local requests for one vendor get a clear conflict instead of racing the provider.
        if (busyVendors.has(vendorId)) return response(res, 409, { error: 'A Test billing request is already in progress for this vendor. Refresh billing status.' })
        busyVendors.add(vendorId)
        try {
          const [status, result] = operation === 'preparations' ? await prepare(vendorId, body)
            : operation === 'cancellations' ? await cancel(vendorId, body)
              : operation === 'resets' ? await reset(vendorId, body) : submit(vendorId, body)
          return response(res, status, result)
        } catch (error) {
          if (!(error instanceof ProviderError)) throw error
          return response(res, error.definite ? 502 : 504, { error: error.definite ? error.message
            : 'The Razorpay Test outcome is uncertain. Refresh billing status; a retry reconciles the same request and never creates a second subscription.' })
        } finally { busyVendors.delete(vendorId) }
      }
      if (req.method === 'POST' && operation === 'scenario') {
        const { scenario } = await requestBody(req)
        if (!scenarios.includes(scenario)) return response(res, 400, { error: 'Choose an available Test scenario.' })
        const existing = store.vendors[vendorId]
        if (existing) return response(res, existing.scenario === scenario ? 200 : 409, existing.scenario === scenario
          ? { record: view(existing) } : { error: 'This vendor already has a scenario. Reset Test scenario first; reset reconciles its Test subscriptions.' })
        const createdAt = now()
        const dates = scenarioDates(scenario, createdAt)
        // Each explicitly selected scenario after a completed reset is a fresh generation.
        const generation = (store.history[vendorId]?.at(-1)?.generation ?? 0) + 1
        const record = {
          vendorId, scenario, generation, selectedAt: createdAt.toISOString(), revision: 1, serverTime: createdAt.toISOString(), ...dates,
          ...currentStatus({ scenario, ...dates }, createdAt),
          attempts: [], associations: [],
        }
        store.vendors[vendorId] = record
        try { saveStore(file, store) } catch (error) { delete store.vendors[vendorId]; throw error }
        return response(res, 201, { record: view(record) })
      }
      if (req.method === 'POST' && operation === 'intents') {
        const { action, idempotencyKey } = await requestBody(req)
        const record = store.vendors[vendorId]
        if (retired(vendorId, idempotencyKey)) return response(res, ...retiredReply)
        if (!record) return response(res, 409, { error: 'Select a scenario first.' })
        if (record.reset) return response(res, ...resetPendingReply)
        if (!['setup_autopay', 'pay_first_fee', 'cancel'].includes(action) || typeof idempotencyKey !== 'string' || !keyPattern.test(idempotencyKey)) {
          return response(res, 400, { error: 'A valid action and idempotency key are required.' })
        }
        const prior = record.attempts.find((attempt) => attempt.idempotencyKey === idempotencyKey)
        if (prior) return response(res, prior.action === action ? 200 : 409, prior.action === action
          ? { record: publicRecord(record) } : { error: 'The idempotency key belongs to another action.' })
        const next = { ...record, revision: record.revision + 1, attempts: [...record.attempts, { action, idempotencyKey, state: 'intent_recorded', associationId: null }] }
        store.vendors[vendorId] = next
        try { saveStore(file, store) } catch (error) { store.vendors[vendorId] = record; throw error }
        return response(res, 201, { record: publicRecord(next) })
      }
      if (req.method === 'POST' && operation === 'associations') {
        const { idempotencyKey, subscriptionId } = await requestBody(req)
        const record = store.vendors[vendorId]
        if (retired(vendorId, idempotencyKey)) return response(res, ...retiredReply)
        if (record?.reset) return response(res, ...resetPendingReply)
        const attempt = record?.attempts.find((item) => item.idempotencyKey === idempotencyKey)
        if (!attempt || !/^sub_[A-Za-z0-9_-]{3,80}$/.test(subscriptionId ?? '')) return response(res, 400, { error: 'A saved intent and Test subscription identifier are required.' })
        if (attempt.associationId) return response(res, attempt.associationId === subscriptionId ? 200 : 409, attempt.associationId === subscriptionId
          ? { record: publicRecord(record) } : { error: 'This intent is already associated with another subscription.' })
        if (record.associations.some((association) => association.id === subscriptionId)) return response(res, 409, { error: 'This subscription is already associated with another intent.' })
        const next = { ...record, revision: record.revision + 1,
          attempts: record.attempts.map((item) => item === attempt ? { ...item, associationId: subscriptionId, state: 'association_unverified' } : item),
          associations: [...record.associations, { id: subscriptionId, state: 'unverified' }],
        }
        store.vendors[vendorId] = next
        try { saveStore(file, store) } catch (error) { store.vendors[vendorId] = record; throw error }
        return response(res, 201, { record: publicRecord(next) })
      }
      response(res, 405, { error: 'Unsupported local helper method.' })
    } catch (error) {
      response(res, 500, { error: error instanceof SyntaxError ? 'Invalid JSON request.' : 'Local helper storage failed.' })
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const server = createVendorBillingTestHelper({
      file: process.env.VENDOR_BILLING_TEST_STORE ?? resolve('vendor-billing-test-store.local'),
      keyId: process.env.RAZORPAY_TEST_KEY_ID,
      secret: process.env.RAZORPAY_TEST_KEY_SECRET,
      planId: process.env.RAZORPAY_TEST_PLAN_ID,
    })
    server.listen(4179, '127.0.0.1', () => process.stdout.write('Local vendor billing Test helper listening on 127.0.0.1:4179\n'))
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1 }
}
