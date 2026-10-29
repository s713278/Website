import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, renameSync, mkdirSync, openSync, closeSync, unlinkSync, fsyncSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/*
  A local stand-in for the backend's vendor billing API, backed by real Razorpay Test calls.

  It serves the published routes (`GET/POST /v1/vendors/{id}/subscription`, `…/confirm`, `…/cancel`,
  `…/history` and `GET /v1/subscription-plans`) under `/api`, in the envelope and wire shape the Live
  Plan reads, and follows the corrected behaviour the backend brief asks for
  (docs/VENDOR_BILLING_BACKEND_BRIEF.md, sections 4 and 7):

  - Free days: subscribe creates a subscription whose first fee is an upfront `addons` item of the
    plan price, with `start_at` = P = T + one month. Its capture is the paid month T → P.
  - Stop the plan: an immediate Razorpay cancel; P is kept and the read says ACTIVE with
    `cancel_at_period_end: true`.
  - Keep shop open: the old subscription is cancelled now and a new addon subscription starts at
    old P + one month.
  - After T unpaid, or after paid days or a halt: an immediate-start subscription, never reusing one
    created during the free days.
  - Renewals extend P only along the original cycle; Razorpay's `pending` reads PAST_DUE and `halted`
    reads HALTED, after which the helper cancels the halted subscription.

  `POST /dev/vendors/{id}/scenario` seeds a vendor's dates and statuses for UI testing. Seeded
  states own no Razorpay object until the vendor pays; every Razorpay object is created here.

  `POST /dev/vendors/{id}/simulation` chooses a simulated payment outcome (stay pending, succeed or
  fail after `simulatedDelayMs`) for outcomes Razorpay Test Checkout cannot produce. While one is
  chosen, subscribe creates a `sub_Sim…` subscription that never reaches Razorpay; the development
  app's stand-in Checkout pays it through `…/simulation/pay`, which returns a callback signed like
  Checkout's, and `…/simulation/deliver` settles a pending payment now. Its Razorpay objects are a
  pure function of the stored payment and now, so the same reconcile reads them.
*/

const dayMs = 24 * 60 * 60 * 1000
const minuteMs = 60 * 1000
const vendorPattern = /^[A-Za-z0-9_-]{1,80}$/
/** Razorpay statuses that can never charge again. */
const closedStatuses = ['cancelled', 'completed', 'expired']
const trialPlan = { code: 'SOCIAL_STARTER_TRIAL', name: 'Social Starter Trial' }
const paidPlan = { code: 'MITHRA_SOCIAL_STARTER_MONTHLY', name: 'Mithra Social Starter' }

/** `definite` means Razorpay rejected the request, so nothing was created or changed. */
export class ProviderError extends Error {
  constructor(message, definite) { super(message); this.name = 'ProviderError'; this.definite = definite }
}

/** An HTTP error answered in the backend's failure envelope. */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
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
    cancelSubscription: (id) => call('POST', `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: 0 }),
  }
}

const iso = (ms) => new Date(ms).toISOString()
/** Payment outcomes the dev panel can choose; `real` is Razorpay Test Checkout. */
const simulationOutcomes = ['real', 'pending', 'succeed', 'fail']
const seconds = (at) => Math.floor(Date.parse(at) / 1000)
/** Whole seconds, as Razorpay stores `start_at`, so a stored P always equals the provider's. */
const wholeSecond = (ms) => Math.floor(ms / 1000) * 1000
/** One billing month later, on the same UTC day and time. */
const addMonth = (at, months = 1) => {
  const date = new Date(at)
  return iso(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()))
}

/**
 * The scenarios the dev panel can seed, relative to now. Every seeded paid period is labelled
 * `seeded`: no Razorpay object or payment stands behind it until the vendor pays.
 */
export const scenarioNames = ['free_days', 'three_days_left', 'trial_ending_soon', 'trial_ended', 'paid', 'stopped', 'autopay_off', 'paid_days_ended', 'renewal_retrying', 'payment_failed']

function seedScenario(scenario, nowMs, trialDays) {
  const at = (offset) => iso(wholeSecond(nowMs + offset))
  const trial = (trialEndsAt) => ({ trialEndsAt, trialStartedAt: iso(Date.parse(trialEndsAt) - trialDays * dayMs) })
  // A paid month that ends at `end`, after free days that ended when it began.
  const paidMonth = (end, changes) => {
    const start = addMonth(end, -1)
    return { ...trial(start), period: { start, end }, seededCharge: { at: start, end }, ...changes }
  }
  switch (scenario) {
    case 'free_days': return trial(at(12 * dayMs))
    case 'three_days_left': return trial(at(3 * dayMs))
    // Long enough to pay in, short enough to watch the free days end.
    case 'trial_ending_soon': return trial(at(5 * minuteMs))
    case 'trial_ended': return trial(at(-2 * dayMs))
    case 'paid': return paidMonth(addMonth(at(0)), { seededRazorpayStatus: 'active' })
    case 'stopped': return paidMonth(at(8 * dayMs), { cancelAtPeriodEnd: true, seededRazorpayStatus: 'cancelled', seededStop: at(-dayMs) })
    case 'autopay_off': return paidMonth(at(8 * dayMs), { externalCancel: true, seededRazorpayStatus: 'cancelled' })
    case 'paid_days_ended': return paidMonth(at(-2 * dayMs), { cancelAtPeriodEnd: true, seededRazorpayStatus: 'cancelled', seededStop: at(-10 * dayMs) })
    // Razorpay retries a declined renewal on each of the three days after P, then halts.
    case 'renewal_retrying': return paidMonth(at(-dayMs), { retrying: true, seededRazorpayStatus: 'pending' })
    case 'payment_failed': return paidMonth(at(-3 * dayMs), { halted: true, seededRazorpayStatus: 'cancelled' })
  }
  throw new HttpError(400, 'Choose an available scenario.')
}

function requireTestConfig({ keyId, secret, planId }) {
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId ?? '') || !secret || typeof secret !== 'string') {
    throw new Error('Set RAZORPAY_TEST_KEY_ID and RAZORPAY_TEST_KEY_SECRET (load .env.billing-helper.local); only rzp_test_ keys are accepted.')
  }
  if (/rzp_live_|live/i.test(secret)) throw new Error('Live provider configuration is refused.')
  if (!/^plan_[A-Za-z0-9]+$/.test(planId ?? '')) throw new Error('Set RAZORPAY_TEST_PLAN_ID to the monthly Test plan.')
}

function readStore(file) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    if (data.version !== 2 || !data.vendors || typeof data.vendors !== 'object') throw new Error('Unknown local billing store format; point VENDOR_BILLING_TEST_STORE at a new file.')
    return { version: 2, vendors: Object.assign(Object.create(null), data.vendors), archive: Object.assign(Object.create(null), data.archive) }
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 2, vendors: Object.create(null), archive: Object.create(null) }
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

async function requestBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 4096) throw new HttpError(413, 'Request is too large.')
  }
  try { return JSON.parse(body || '{}') } catch { throw new HttpError(400, 'Invalid JSON request.') }
}

/** A simulated payment's phase at `atMs`: `pending` until it settles, then `captured` or `failed`. */
function paymentPhase(payment, atMs) {
  if (!payment.settleAt || atMs < Date.parse(payment.settleAt)) return 'pending'
  return payment.outcome === 'succeed' ? 'captured' : 'failed'
}
/** Simulated time stops when the subscription was cancelled, so a payment pending then never settles. */
const simulatedAt = (subscription, nowMs) => subscription.simulatedCancelledAt ? Math.min(nowMs, Date.parse(subscription.simulatedCancelledAt)) : nowMs
/** The phase of a simulated subscription's latest payment, or null before its first. */
function simulatedPhase(subscription, nowMs) {
  const payment = subscription.simulatedPayments?.at(-1)
  return payment ? paymentPhase(payment, simulatedAt(subscription, nowMs)) : null
}
/** A simulated subscription whose latest payment failed: Razorpay leaves it unchanged, ready for a retry. */
const simulatedFailed = (subscription, nowMs) => Boolean(subscription?.simulated) && !subscription.paid && simulatedPhase(subscription, nowMs) === 'failed'
/** A simulated payment phase as Razorpay's payment status. */
const paymentStatuses = { pending: 'authorized', captured: 'captured', failed: 'failed' }

/**
 * The latest payment on the vendor's current subscription, as the read's requested
 * `latest_payment_id` and `latest_payment_status` (docs/API_GAPS.md, billing read gaps). Only a
 * simulated subscription reports one; a real Razorpay Test subscription reports none, as no
 * Razorpay payment is read for it here.
 */
function latestPayment(subscription, nowMs) {
  const payment = subscription?.simulated ? subscription.simulatedPayments.at(-1) : null
  return payment ? { id: payment.paymentId, status: paymentStatuses[simulatedPhase(subscription, nowMs)] } : { id: null, status: null }
}

/**
 * Razorpay's objects for a simulated subscription, scripted from its stored payments and now, in the
 * provider's shape. Addon kinds turn `authenticated` with the first payment and stay so; their addon
 * invoice is `paid` once a payment is captured. An immediate start stays `created` until its payment
 * is captured, then turns `active` with a paid invoice for paidAt → one month later. A failed payment
 * changes neither the subscription nor the invoice. Nothing here reaches Razorpay.
 */
function scriptedRazorpay(subscription, { planId, nowMs }) {
  const at = () => simulatedAt(subscription, nowMs())
  const payments = subscription.simulatedPayments
  const latest = () => payments.at(-1) ?? null
  const captured = () => payments.find((payment) => paymentPhase(payment, at()) === 'captured') ?? null
  const status = () => {
    if (subscription.simulatedCancelledAt) return 'cancelled'
    if (subscription.kind === 'immediate') return captured() ? 'active' : 'created'
    return latest() ? 'authenticated' : 'created'
  }
  const invoiceId = `inv_${subscription.id.slice('sub_'.length)}`
  const missing = async () => { throw new ProviderError('A simulated subscription has no such Razorpay call.', true) }
  return {
    createSubscription: missing,
    fetchPlan: missing,
    fetchSubscription: async (id) => ({ id, status: status(), plan_id: planId, start_at: subscription.startAt ? seconds(subscription.startAt) : null, notes: subscription.notes }),
    listInvoices: async () => {
      const amount = subscription.amountMinor
      const paid = captured()
      if (subscription.kind === 'immediate') {
        if (!paid) return { items: [] }
        const start = wholeSecond(Date.parse(paid.paidAt))
        return { items: [{ id: invoiceId, subscription_id: subscription.id, status: 'paid', amount, payment_id: paid.paymentId, billing_start: start / 1000, billing_end: seconds(addMonth(start)), line_items: [{ type: 'plan', amount }] }] }
      }
      if (!latest()) return { items: [] }
      return { items: [{ id: invoiceId, subscription_id: subscription.id, status: paid ? 'paid' : 'issued', amount, payment_id: paid?.paymentId ?? null, billing_start: null, billing_end: null, line_items: [{ type: 'addon', amount }] }] }
    },
    fetchPayment: async (id) => {
      const payment = payments.find((item) => item.paymentId === id)
      if (!payment) throw new ProviderError('No such simulated payment.', true)
      return { id, amount: subscription.amountMinor, currency: 'INR', status: paymentStatuses[paymentPhase(payment, at())] }
    },
    cancelSubscription: async () => {
      subscription.simulatedCancelledAt ??= iso(nowMs())
      return {}
    },
  }
}

/** The vendor's latest Razorpay subscription, which decides what is collected next. */
const currentOf = (record) => record.subscriptions.at(-1) ?? null
const openOf = (record) => record.subscriptions.filter((item) => !item.closed)

/**
 * The backend's subscription read for a vendor record at `nowMs`, as section 4 of the brief
 * requires it. Seeded states report their seeded Razorpay status until a Razorpay object exists.
 */
export function subscriptionRow(record, nowMs) {
  const current = currentOf(record)
  const beforeT = nowMs < Date.parse(record.trialEndsAt)
  // Paying after T, or after paid days or a halt: PAYMENT_PENDING until the charge is captured.
  // A simulated first payment that failed after a halt leaves the halt showing.
  const payingNow = current && current.kind === 'immediate' && !current.paid && !current.closed && !(record.halted && simulatedFailed(current, nowMs))
  // Keep shop open keeps the stopped read until its ₹ is captured (flow 3).
  const reported = current && current.kind === 'keep_open' && !current.paid ? record.subscriptions.at(-2) ?? null : current
  const status = payingNow ? 'PAYMENT_PENDING'
    : record.halted ? 'HALTED'
      : record.period ? (record.externalCancel ? 'CANCELLED' : record.retrying ? 'PAST_DUE' : 'ACTIVE')
        : beforeT ? 'TRIAL_ACTIVE' : 'TRIAL_EXPIRED'
  const paid = Boolean(record.period) || payingNow || record.halted
  const renewing = status === 'ACTIVE' && !record.cancelAtPeriodEnd
  const payment = latestPayment(current, nowMs)
  return {
    subscription_id: record.rowId,
    vendor_id: record.vendorId,
    plan_code: paid ? paidPlan.code : trialPlan.code,
    plan_name: paid ? paidPlan.name : trialPlan.name,
    billing_cycle: 'MONTHLY',
    currency: 'INR',
    sale_price: paid ? record.planPrice : 0,
    status,
    trial_started_at: record.trialStartedAt,
    trial_ends_at: record.trialEndsAt,
    razorpay_subscription_id: reported?.id ?? null,
    // After a simulated early fee fails, the backend still reads plain free days, not a payment being confirmed.
    razorpay_status: (simulatedFailed(reported, nowMs) ? 'created' : reported?.razorpayStatus) ?? record.seededRazorpayStatus ?? null,
    current_period_start: record.period?.start ?? null,
    current_period_end: record.period?.end ?? null,
    next_billing_at: renewing ? record.period?.end ?? null : null,
    cancel_at_period_end: Boolean(record.period) && Boolean(record.cancelAtPeriodEnd),
    latest_payment_id: payment.id,
    latest_payment_status: payment.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  }
}

/** Local-only HTTP boundary over the vendor billing store and Razorpay Test. */
export function createVendorBillingTestHelper({ file, keyId, secret, planId, trialDays = 14, simulatedDelayMs = 5000, now = () => new Date(), provider }) {
  requireTestConfig({ keyId, secret, planId })
  const client = provider ?? createRazorpayTestProvider({ keyId, secret })
  const store = readStore(file)
  /** Every request for a vendor runs after the one before it, so reads and writes never race Razorpay. */
  const queues = new Map()
  let plan = null

  const nowMs = () => now().getTime()
  const stamp = () => now().toISOString()
  /** Razorpay Test for a real subscription; the scripted objects for a simulated one. */
  const providerFor = (subscription) => subscription.simulated ? scriptedRazorpay(subscription, { planId, nowMs }) : client

  /** The configured plan, read once: a monthly INR plan whose price is every fee and addon. */
  async function readPlan() {
    if (plan) return plan
    const read = await client.fetchPlan(planId)
    if (read.id !== planId || read.period !== 'monthly' || read.interval !== 1 || read.item?.currency !== 'INR' || !Number.isSafeInteger(read.item?.amount) || read.item.amount <= 0) {
      throw new HttpError(500, 'RAZORPAY_TEST_PLAN_ID is not a monthly (interval 1) INR plan.')
    }
    plan = { amountMinor: read.item.amount }
    return plan
  }

  function save(vendorId, record) {
    const previous = store.vendors[vendorId]
    store.vendors[vendorId] = { ...record, updatedAt: stamp() }
    try { saveStore(file, store) } catch (error) { store.vendors[vendorId] = previous; throw error }
    return store.vendors[vendorId]
  }

  function event(record, type, changes = {}) {
    record.history.push({
      event_id: record.history.length + 1, event_type: type, event_at: stamp(),
      previous_status: changes.previous ?? null, new_status: changes.next ?? null,
      external_subscription_id: changes.subscriptionId ?? null, external_payment_id: changes.paymentId ?? null,
      ...(changes.amount !== undefined ? { amount: changes.amount } : {}),
    })
  }
  const statusOf = (record) => subscriptionRow(record, nowMs()).status

  /** Cancels a recorded subscription now and reads it closed; an object already closed is settled. */
  async function closeSubscription(record, subscription, by) {
    if (subscription.closed) return
    const razorpay = providerFor(subscription)
    let read = await razorpay.fetchSubscription(subscription.id)
    if (!closedStatuses.includes(read.status)) {
      await razorpay.cancelSubscription(subscription.id)
      read = await razorpay.fetchSubscription(subscription.id)
    }
    if (!closedStatuses.includes(read.status)) throw new HttpError(502, 'Razorpay Test has not shown the old subscription closed yet. Try again in a moment.')
    Object.assign(subscription, { razorpayStatus: read.status, closed: true, cancelledBy: subscription.cancelledBy ?? by })
  }

  /** The subscription's captured ₹ payment for `invoice`, or null. A refunded payment is never a fee. */
  async function capturedPayment(razorpay, invoice, amountMinor) {
    if (invoice.status !== 'paid' || !invoice.payment_id || invoice.amount !== amountMinor) return null
    const payment = await razorpay.fetchPayment(invoice.payment_id)
    return payment.status === 'captured' && payment.amount === amountMinor && payment.currency === 'INR' && !payment.refund_status ? payment : null
  }

  /**
   * Rereads every open Razorpay subscription the vendor has and applies only what Razorpay shows:
   * an upfront or immediate fee captured, renewals along the original cycle, retrying, halts and
   * cancellations from outside. Free-days subscriptions still `created` at T are cancelled (recipe 4).
   */
  async function reconcile(record) {
    const { amountMinor } = await readPlan()
    for (const subscription of record.subscriptions) {
      if (subscription.closed) continue
      const razorpay = providerFor(subscription)
      const read = await razorpay.fetchSubscription(subscription.id)
      if (read.id !== subscription.id || read.notes?.md_vendor !== record.vendorId) throw new HttpError(500, 'Razorpay Test returned a subscription this vendor does not own.')
      const before = statusOf(record)
      if (read.status === 'authenticated' && !subscription.authenticated) {
        subscription.authenticated = true
        event(record, 'SUBSCRIPTION_AUTHENTICATED', { previous: before, next: before, subscriptionId: subscription.id })
      }
      subscription.razorpayStatus = read.status
      const { items: invoices = [] } = await razorpay.listInvoices({ subscriptionId: subscription.id })
      const charged = (payment, period) => {
        event(record, 'SUBSCRIPTION_CHARGED', { previous: before, next: 'ACTIVE', subscriptionId: subscription.id, paymentId: payment.id, amount: amountMinor / 100 })
        Object.assign(record, { period, retrying: false, halted: false, externalCancel: false })
      }

      if (!subscription.paid) {
        // The upfront ₹ has no billing dates: Razorpay records no period for it, so the helper stores T → P (or old P → new P).
        const first = subscription.kind === 'immediate'
          ? invoices.filter((item) => Number.isSafeInteger(item.billing_start)).sort((a, b) => a.billing_start - b.billing_start)[0]
          : invoices.find((item) => !item.billing_start && item.line_items?.some((line) => line.type === 'addon'))
        const payment = first ? await capturedPayment(razorpay, first, amountMinor) : null
        if (payment) {
          subscription.paid = true
          subscription.countedInvoices = [first.id]
          charged(payment, subscription.kind === 'immediate'
            ? { start: iso(first.billing_start * 1000), end: iso(first.billing_end * 1000) }
            : { start: subscription.coverStart, end: subscription.startAt })
          record.cancelAtPeriodEnd = false
        }
      }
      if (subscription.simulated && !subscription.paid) {
        // A failed simulated payment leaves the subscription for a retry; the history notes it once.
        for (const { paymentId } of subscription.simulatedPayments) {
          if ((await razorpay.fetchPayment(paymentId)).status === 'failed' && !record.history.some((item) => item.event_type === 'PAYMENT_FAILED' && item.external_payment_id === paymentId)) {
            event(record, 'PAYMENT_FAILED', { previous: before, next: statusOf(record), subscriptionId: subscription.id, paymentId })
          }
        }
      }
      if (subscription.paid && record.period) {
        // A renewal is the next cycle starting exactly at P; a retry that succeeds keeps that cycle's dates.
        for (;;) {
          const renewal = invoices.find((item) => item.billing_start === seconds(record.period.end) && !subscription.countedInvoices.includes(item.id))
          const payment = renewal ? await capturedPayment(razorpay, renewal, amountMinor) : null
          if (!payment) break
          subscription.countedInvoices.push(renewal.id)
          charged(payment, { start: iso(renewal.billing_start * 1000), end: iso(renewal.billing_end * 1000) })
        }
      }

      if (closedStatuses.includes(read.status)) {
        subscription.closed = true
        if (!subscription.cancelledBy) {
          subscription.cancelledBy = 'outside'
          // AutoPay ended outside MithraDirect: P is kept and the read says CANCELLED (flow 6).
          if (subscription === currentOf(record) && subscription.paid && !record.cancelAtPeriodEnd) record.externalCancel = true
          event(record, 'SUBSCRIPTION_CANCELLED', { previous: before, next: statusOf(record), subscriptionId: subscription.id })
        }
        continue
      }
      if (subscription.paid && subscription === currentOf(record)) {
        // Only a halt is a failed fee; Razorpay's `pending` is the collection retry period.
        record.retrying = read.status === 'pending' && nowMs() >= Date.parse(record.period.end)
        if (read.status === 'halted' && !record.halted) {
          record.halted = true
          record.retrying = false
          event(record, 'SUBSCRIPTION_HALTED', { previous: before, next: 'HALTED', subscriptionId: subscription.id })
          await closeSubscription(record, subscription, 'helper')
          event(record, 'SUBSCRIPTION_CANCELLED', { previous: 'HALTED', next: 'HALTED', subscriptionId: subscription.id })
        }
      }
      if (!subscription.paid && subscription.kind === 'early' && read.status === 'created' && nowMs() >= Date.parse(record.trialEndsAt)) {
        await closeSubscription(record, subscription, 'helper')
      }
    }
    return record
  }

  /** A fresh vendor record from a seeded scenario. */
  async function seed(vendorId, scenario) {
    if (!scenarioNames.includes(scenario)) throw new HttpError(400, 'Choose an available scenario.')
    const { amountMinor } = await readPlan()
    let previous = store.vendors[vendorId]
    // Nothing the earlier scenario created may charge later: each of its subscriptions is read closed first.
    if (previous) {
      previous = structuredClone(previous)
      for (const subscription of openOf(previous)) await closeSubscription(previous, subscription, 'reset')
      store.archive[vendorId] = [...(store.archive[vendorId] ?? []), { scenario: previous.scenario, archivedAt: stamp(), subscriptions: previous.subscriptions.map(({ id, kind, razorpayStatus, paid }) => ({ id, kind, razorpayStatus, paid })) }]
    }
    const seeded = seedScenario(scenario, nowMs(), trialDays)
    const record = {
      vendorId, scenario, rowId: 9001,
      planPrice: amountMinor / 100, createdAt: stamp(), subscriptions: [], history: [],
      period: null, cancelAtPeriodEnd: false, externalCancel: false, retrying: false, halted: false, seededRazorpayStatus: null,
      simulation: previous?.simulation ?? null,
      ...seeded,
    }
    if (seeded.seededCharge) record.history.push({ event_id: 1, event_type: 'SUBSCRIPTION_CHARGED', event_at: seeded.seededCharge.at, previous_status: 'TRIAL_ACTIVE', new_status: 'ACTIVE', external_subscription_id: 'sub_seeded', external_payment_id: 'pay_seeded1', amount: record.planPrice })
    if (seeded.seededStop) record.history.push({ event_id: 2, event_type: 'CANCELLATION_REQUESTED', event_at: seeded.seededStop, previous_status: 'ACTIVE', new_status: 'ACTIVE', external_subscription_id: 'sub_seeded', external_payment_id: null })
    if (scenario === 'autopay_off') record.history.push({ event_id: 2, event_type: 'SUBSCRIPTION_CANCELLED', event_at: iso(nowMs() - dayMs), previous_status: 'ACTIVE', new_status: 'CANCELLED', external_subscription_id: 'sub_seeded', external_payment_id: null })
    delete record.seededCharge
    delete record.seededStop
    return save(vendorId, record)
  }

  function requireRecord(vendorId) {
    const record = store.vendors[vendorId]
    // Before go-live the backend answers 404; here, before a scenario is chosen.
    if (!record) throw new HttpError(404, 'No subscription for this vendor yet. Choose a scenario on Plan.')
    return structuredClone(record)
  }

  async function read(vendorId) {
    const record = await reconcile(requireRecord(vendorId))
    return subscriptionRow(save(vendorId, record), nowMs())
  }

  /**
   * Creates the Razorpay subscription for `kind`; `startAt` and `coverStart` belong to the addon kinds.
   * While a simulated outcome is chosen, the subscription is simulated and Razorpay is never called.
   */
  async function create(record, kind, { startAt = null, coverStart = null } = {}) {
    const { amountMinor } = await readPlan()
    const notes = { md_vendor: record.vendorId, md_kind: kind, md_scenario: record.scenario }
    const created = record.simulation
      ? { id: `sub_Sim${randomBytes(6).toString('hex')}`, status: 'created', short_url: null }
      : await client.createSubscription({
        plan_id: planId, total_count: 12, quantity: 1, customer_notify: 0,
        ...(startAt ? { start_at: seconds(startAt), addons: [{ item: { name: kind === 'early' ? 'First month' : 'Next month', amount: amountMinor, currency: 'INR' } }] } : {}),
        notes,
      })
    const subscription = { id: created.id, kind, createdAt: stamp(), startAt, coverStart, razorpayStatus: created.status, shortUrl: created.short_url ?? null, paid: false, closed: false, cancelledBy: null, countedInvoices: [],
      ...(record.simulation ? { simulated: true, notes, amountMinor, simulatedPayments: [], simulatedCancelledAt: null } : {}) }
    record.subscriptions.push(subscription)
    event(record, 'CHECKOUT_CREATED', { previous: statusOf(record), next: statusOf(record), subscriptionId: created.id })
    return subscription
  }

  /**
   * A repeat while a subscription is unpaid and still `created` returns it; anything else is not reusable.
   * A simulated one is reused with no payment yet or after a failed one, and only while an outcome is
   * simulated; a real one only while none is.
   */
  const reusable = (record, subscription, kind, startAt = null) => subscription && subscription.kind === kind && !subscription.paid && !subscription.closed
    && Boolean(subscription.simulated) === Boolean(record.simulation) && subscription.startAt === startAt
    && (subscription.simulated ? simulatedPhase(subscription, nowMs()) !== 'pending' : subscription.razorpayStatus === 'created')
  /** A first payment Razorpay may still be confirming. A real one is known only once its subscription is past `created`. */
  const paymentPending = (subscription) => subscription && !subscription.paid && !subscription.closed
    && (subscription.simulated ? simulatedPhase(subscription, nowMs()) === 'pending' : subscription.razorpayStatus !== 'created')

  /** Subscribe: decided on server time, after reconciling, as flows 1, 3 and 4 describe. */
  async function subscribe(vendorId, body) {
    if (body?.plan_code !== paidPlan.code) throw new HttpError(400, 'This plan is not purchasable.')
    const record = await reconcile(requireRecord(vendorId))
    const current = currentOf(record)
    const at = nowMs()
    let subscription
    if (paymentPending(current)) {
      throw new HttpError(409, 'A payment for this plan is already being confirmed.')
    }
    if (record.period && at < Date.parse(record.period.end) && !record.halted) {
      if (!record.cancelAtPeriodEnd && !record.externalCancel) throw new HttpError(409, 'An active subscription already exists.')
      // Keep shop open: ₹ now for old P → old P + one month; AutoPay from then.
      const startAt = addMonth(record.period.end)
      if (reusable(record, current, 'keep_open', startAt)) subscription = current
      else {
        for (const open of openOf(record)) await closeSubscription(record, open, 'replaced')
        subscription = await create(record, 'keep_open', { startAt, coverStart: record.period.end })
      }
    } else if (!record.period && at < Date.parse(record.trialEndsAt)) {
      // The early first fee: ₹ now for T → T + one month, no free day lost.
      const startAt = addMonth(record.trialEndsAt)
      if (reusable(record, current, 'early', startAt)) subscription = current
      else {
        for (const open of openOf(record)) await closeSubscription(record, open, 'replaced')
        subscription = await create(record, 'early', { startAt, coverStart: record.trialEndsAt })
      }
    } else if (reusable(record, current, 'immediate')) subscription = current
    else {
      // Never reuse a free-days subscription after T (gap I): close every open one first.
      for (const open of openOf(record)) await closeSubscription(record, open, 'replaced')
      subscription = await create(record, 'immediate')
    }
    const saved = save(vendorId, record)
    return { ...subscriptionRow(saved, nowMs()), razorpay_key_id: keyId, razorpay_subscription_id: subscription.id, checkout_url: subscription.shortUrl }
  }

  /** Checks Checkout's signature over `payment_id|subscription_id`; writes one PAYMENT_AUTHORIZED per payment. */
  async function confirm(vendorId, body) {
    const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = body ?? {}
    if (!/^pay_[A-Za-z0-9]{1,40}$/.test(paymentId ?? '') || typeof subscriptionId !== 'string' || typeof signature !== 'string') {
      throw new HttpError(400, 'Checkout returned incomplete details.')
    }
    let record = requireRecord(vendorId)
    if (!record.subscriptions.some((item) => item.id === subscriptionId && !item.closed)) throw new HttpError(400, 'This payment is for another subscription.')
    const expected = createHmac('sha256', secret).update(`${paymentId}|${subscriptionId}`).digest()
    const given = /^[a-f0-9]{64}$/.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0)
    if (given.length !== expected.length || !timingSafeEqual(expected, given)) throw new HttpError(401, 'The Checkout signature did not verify.')
    if (!record.history.some((item) => item.event_type === 'PAYMENT_AUTHORIZED' && item.external_payment_id === paymentId)) {
      event(record, 'PAYMENT_AUTHORIZED', { previous: statusOf(record), next: statusOf(record), subscriptionId, paymentId })
    }
    record = await reconcile(record)
    return subscriptionRow(save(vendorId, record), nowMs())
  }

  /** Stop the plan: an immediate Razorpay cancel that keeps P (flow 2), or ends a payment still pending. */
  async function cancel(vendorId) {
    const record = await reconcile(requireRecord(vendorId))
    const before = statusOf(record)
    const open = openOf(record)
    const current = currentOf(record)
    const stop = async () => {
      for (const subscription of open) {
        try { await closeSubscription(record, subscription, 'vendor') } catch (error) {
          // Razorpay's refusal is answered as a 4xx with its reason, not a 500.
          if (error instanceof ProviderError && error.definite) throw new HttpError(400, error.message)
          throw error
        }
      }
    }
    if (before === 'PAYMENT_PENDING') {
      await stop()
      event(record, 'CANCELLATION_REQUESTED', { previous: before, next: statusOf(record), subscriptionId: current.id })
    } else if (['ACTIVE', 'PAST_DUE'].includes(before) && record.period) {
      // A repeat changes nothing and writes no second row.
      if (!record.cancelAtPeriodEnd) {
        await stop()
        // A cancellation during the retry period ends the retries; coverage has already ended.
        Object.assign(record, { cancelAtPeriodEnd: true, retrying: false, seededRazorpayStatus: record.subscriptions.length ? record.seededRazorpayStatus : 'cancelled' })
        event(record, 'CANCELLATION_REQUESTED', { previous: before, next: 'ACTIVE', subscriptionId: current?.id ?? 'sub_seeded' })
      }
    } else throw new HttpError(409, 'There is no active subscription to cancel.')
    return subscriptionRow(save(vendorId, record), nowMs())
  }

  /** The vendor's chosen payment outcome and the simulated delay; `real` before a scenario too. */
  function simulation(vendorId) {
    return { outcome: store.vendors[vendorId]?.simulation ?? 'real', delay_ms: simulatedDelayMs }
  }

  async function simulate(vendorId, body) {
    if (!simulationOutcomes.includes(body?.outcome)) throw new HttpError(400, 'Choose real, pending, succeed or fail.')
    const record = requireRecord(vendorId)
    save(vendorId, { ...record, simulation: body.outcome === 'real' ? null : body.outcome })
    return simulation(vendorId)
  }

  /**
   * The stand-in Checkout's payment on a simulated subscription: records it with the chosen outcome
   * and returns Checkout's callback, signed as Razorpay signs it, for the Plan to confirm.
   */
  async function simulatedPay(vendorId, body) {
    const record = await reconcile(requireRecord(vendorId))
    const subscription = record.subscriptions.find((item) => item.id === body?.subscription_id)
    if (!subscription) throw new HttpError(400, 'This payment is for another subscription.')
    if (!subscription.simulated) throw new HttpError(400, 'This subscription is real; pay it with Razorpay Test Checkout.')
    if (!record.simulation) throw new HttpError(409, 'Choose a simulated payment outcome first.')
    if (subscription.closed || subscription.paid) throw new HttpError(409, 'This subscription takes no more payments.')
    if (simulatedPhase(subscription, nowMs()) === 'pending') throw new HttpError(409, 'A payment for this plan is already being confirmed.')
    const paymentId = `pay_Sim${randomBytes(6).toString('hex')}`
    subscription.simulatedPayments.push({ paymentId, outcome: record.simulation, paidAt: stamp(), settleAt: record.simulation === 'pending' ? null : iso(nowMs() + simulatedDelayMs) })
    save(vendorId, record)
    return { razorpay_payment_id: paymentId, razorpay_subscription_id: subscription.id, razorpay_signature: createHmac('sha256', secret).update(`${paymentId}|${subscription.id}`).digest('hex') }
  }

  /** Settles the vendor's pending simulated payment now, as Razorpay finally would. */
  async function deliver(vendorId, body) {
    if (!['succeed', 'fail'].includes(body?.result)) throw new HttpError(400, 'Deliver succeed or fail.')
    let record = await reconcile(requireRecord(vendorId))
    const current = currentOf(record)
    if (!current?.simulated || current.closed || simulatedPhase(current, nowMs()) !== 'pending') throw new HttpError(409, 'No simulated payment is pending.')
    Object.assign(current.simulatedPayments.at(-1), { outcome: body.result, settleAt: stamp() })
    record = await reconcile(record)
    return subscriptionRow(save(vendorId, record), nowMs())
  }

  async function plans() {
    const { amountMinor } = await readPlan()
    return [{ plan_id: 2, plan_code: paidPlan.code, plan_name: paidPlan.name, billing_cycle: 'MONTHLY', currency: 'INR', sale_price: amountMinor / 100, external_plan_id: planId }]
  }

  /** Runs `task` after every earlier request for the vendor. */
  function queued(vendorId, task) {
    const previous = queues.get(vendorId) ?? Promise.resolve()
    const run = previous.catch(() => {}).then(task)
    const tail = run.catch(() => {})
    queues.set(vendorId, tail)
    tail.then(() => { if (queues.get(vendorId) === tail) queues.delete(vendorId) })
    return run
  }

  const envelope = (status, data) => ({ timestamp: stamp(), success: status < 400, status, ...(status < 400 ? { data } : { message: data }) })
  function respond(res, status, data) {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
    res.end(JSON.stringify(envelope(status, data)))
  }

  return createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && (req.headers['content-type'] !== 'application/json'
        || (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)))) {
        return respond(res, 403, 'Local billing writes require the local development app.')
      }
      const path = new URL(req.url, 'http://localhost').pathname
      if (req.method === 'GET' && path === '/api/v1/subscription-plans') return respond(res, 200, await plans())
      if (req.method === 'GET' && path === '/dev/scenarios') return respond(res, 200, scenarioNames)
      const scenarioMatch = /^\/dev\/vendors\/([^/]+)\/scenario$/.exec(path)
      if (scenarioMatch && vendorPattern.test(scenarioMatch[1]) && req.method === 'POST') {
        const body = await requestBody(req)
        const record = await queued(scenarioMatch[1], () => seed(scenarioMatch[1], body?.scenario))
        return respond(res, 200, { scenario: record.scenario, subscription: subscriptionRow(record, nowMs()) })
      }
      const simulationMatch = /^\/dev\/vendors\/([^/]+)\/simulation(?:\/(pay|deliver))?$/.exec(path)
      if (simulationMatch && vendorPattern.test(simulationMatch[1])) {
        const [, vendorId, operation] = simulationMatch
        const body = req.method === 'POST' ? await requestBody(req) : null
        const result = await queued(vendorId, async () => {
          if (req.method === 'GET' && !operation) return simulation(vendorId)
          if (req.method === 'POST' && !operation) return simulate(vendorId, body)
          if (req.method === 'POST' && operation === 'pay') return simulatedPay(vendorId, body)
          if (req.method === 'POST' && operation === 'deliver') return deliver(vendorId, body)
          throw new HttpError(405, 'Unsupported local billing method.')
        })
        return respond(res, 200, result)
      }
      const match = /^\/api\/v1\/vendors\/([^/]+)\/subscription(?:\/(confirm|cancel|history))?$/.exec(path)
      if (!match || !vendorPattern.test(match[1])) return respond(res, 404, 'Unknown local billing route.')
      const [, vendorId, operation] = match
      const body = req.method === 'POST' ? await requestBody(req) : null
      const result = await queued(vendorId, async () => {
        if (req.method === 'GET' && !operation) return read(vendorId)
        if (req.method === 'GET' && operation === 'history') {
          await read(vendorId)
          return [...store.vendors[vendorId].history].reverse().slice(0, 100)
        }
        if (req.method === 'POST' && !operation) return subscribe(vendorId, body)
        if (req.method === 'POST' && operation === 'confirm') return confirm(vendorId, body)
        if (req.method === 'POST' && operation === 'cancel') return cancel(vendorId)
        throw new HttpError(405, 'Unsupported local billing method.')
      })
      return respond(res, 200, result)
    } catch (error) {
      if (error instanceof HttpError) return respond(res, error.status, error.message)
      if (error instanceof ProviderError) return respond(res, error.definite ? 502 : 504, error.definite ? error.message : 'Razorpay Test did not respond. Try again in a moment.')
      respond(res, 500, 'Local billing helper failed.')
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const trialDays = Number(process.env.BILLING_HELPER_TRIAL_DAYS ?? 14)
    const simulatedDelayMs = Number(process.env.BILLING_HELPER_SIMULATED_DELAY_MS ?? 5000)
    const server = createVendorBillingTestHelper({
      file: process.env.VENDOR_BILLING_TEST_STORE ?? resolve('vendor-billing-backend-store.local'),
      keyId: process.env.RAZORPAY_TEST_KEY_ID,
      secret: process.env.RAZORPAY_TEST_KEY_SECRET,
      planId: process.env.RAZORPAY_TEST_PLAN_ID,
      trialDays: Number.isInteger(trialDays) && trialDays > 0 ? trialDays : 14,
      simulatedDelayMs: Number.isSafeInteger(simulatedDelayMs) && simulatedDelayMs > 0 ? simulatedDelayMs : 5000,
    })
    server.listen(4179, '127.0.0.1', () => process.stdout.write('Local vendor billing backend (Razorpay Test) listening on 127.0.0.1:4179\n'))
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1 }
}
