import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVendorBillingTestHelper, ProviderError } from './vendor-billing-test-helper.mjs'

const directory = mkdtempSync(join(tmpdir(), 'mithra-billing-helper-'))
const file = join(directory, 'scenarios.json')
after(() => rmSync(directory, { recursive: true, force: true }))

let currentTime = '2026-09-23T10:00:00Z'
async function open(options = {}) {
  const server = createVendorBillingTestHelper({ file, keyId: 'rzp_test_placeholder', secret: 'local_test_placeholder', planId: 'plan_monthly', now: () => new Date(currentTime), ...options })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  return { server, url, close: () => new Promise((resolve) => server.close(resolve)) }
}

async function request(url, method, path, data, origin) {
  const response = await fetch(`${url}${path}`, { method, headers: data ? { 'content-type': 'application/json', ...(origin ? { origin } : {}) } : undefined, body: data ? JSON.stringify(data) : undefined })
  return { status: response.status, body: await response.json() }
}

test('keeps each vendor scenario, boundaries and intent ledger across a fresh helper instance', async () => {
  const first = await open()
  try {
    const selected = await request(first.url, 'POST', '/vendors/vendor_A/scenario', { scenario: 'active_trial' }, 'http://127.0.0.1:5174')
    assert.equal(selected.status, 201)
    assert.equal(selected.body.record.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.equal((await request(first.url, 'POST', '/vendors/vendor_A/intents', { action: 'setup_autopay', idempotencyKey: 'request_A123' })).status, 201)
    assert.equal((await request(first.url, 'POST', '/vendors/vendor_A/associations', { idempotencyKey: 'request_A123', subscriptionId: 'sub_testA123' })).status, 201)
    assert.equal((await request(first.url, 'POST', '/vendors/vendor_B/scenario', { scenario: 'expired_trial' })).status, 201)
    assert.equal((await request(first.url, 'POST', '/vendors/constructor/scenario', { scenario: 'paid_sample' })).status, 201)
    assert.equal((await request(first.url, 'POST', '/vendors/vendor_C/scenario', { scenario: 'active_trial' }, 'https://example.com')).status, 403)
  } finally { await first.close() }

  const reopened = await open()
  try {
    const restored = await request(reopened.url, 'GET', '/vendors/vendor_A/status')
    assert.equal(restored.status, 200)
    assert.equal(restored.body.record.scenario, 'active_trial')
    assert.equal(restored.body.record.revision, 3)
    assert.equal(restored.body.record.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.deepEqual(restored.body.record.attempts, [{ action: 'setup_autopay', idempotencyKey: 'request_A123', state: 'association_unverified', associationId: 'sub_testA123' }])
    assert.deepEqual(restored.body.record.associations, [{ id: 'sub_testA123', state: 'unverified' }])
    assert.equal((await request(reopened.url, 'POST', '/vendors/vendor_A/scenario', { scenario: 'paid_sample' })).status, 409)
    assert.equal((await request(reopened.url, 'POST', '/vendors/vendor_A/scenario', { scenario: 'active_trial' })).body.record.revision, 3)
    assert.equal((await request(reopened.url, 'POST', '/vendors/vendor_A/intents', { action: 'setup_autopay', idempotencyKey: 'request_A123' })).body.record.attempts.length, 1)
    assert.equal((await request(reopened.url, 'GET', '/vendors/vendor_B/status')).body.record.scenario, 'expired_trial')
    assert.equal((await request(reopened.url, 'GET', '/vendors/constructor/status')).body.record.scenario, 'paid_sample')
    assert.equal((await request(reopened.url, 'GET', '/vendors/vendor_C/status')).body.record, null)
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).vendors.vendor_A.associations.length, 1)
    currentTime = '2026-10-08T10:00:00Z'
    const aged = (await request(reopened.url, 'GET', '/vendors/vendor_A/status')).body.record
    assert.equal(aged.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.equal(aged.accessStatus, 'TRIAL_ENDED')
    assert.equal(aged.daysRemaining, 0)
    assert.equal(aged.storeVisible, false)
  } finally { await reopened.close() }
})

test('rejects live or missing configuration before listening', () => {
  assert.throws(() => createVendorBillingTestHelper({ file, keyId: 'rzp_live_x', secret: 'x' }), /only rzp_test_/)
  assert.throws(() => createVendorBillingTestHelper({ file, keyId: 'rzp_test_x' }), /RAZORPAY_TEST_KEY_SECRET/)
  assert.throws(() => createVendorBillingTestHelper({ file, keyId: 'rzp_test_x', secret: 'x' }), /RAZORPAY_TEST_PLAN_ID/)
})

/** Stands in for Razorpay Test at the provider edge; it outlives helper instances like the real account. */
function fakeProvider({ amount = 29900, currency = 'INR' } = {}) {
  const subscriptions = new Map()
  const invoices = []
  const payments = new Map()
  const calls = { create: [], list: 0, cancel: [] }
  let next = 0
  const provider = {
    subscriptions, invoices, payments, calls, failCreate: null, failFetch: null, failReads: false, failCancel: null, readStore: null,
    /** Test Dashboard stand-ins: customer authorisation and a provider charge with its invoice. */
    authenticate(id, status = 'authenticated', tokenAmount = 500) {
      Object.assign(subscriptions.get(id), { status })
      if (tokenAmount) provider.charge(id, { amount: tokenAmount, start: 0, end: 0 })
    },
    charge(id, { amount = 29900, currency = 'INR', start, end, invoiceStatus = 'paid', paymentStatus = 'captured', paymentAmount = amount }) {
      const paymentId = `pay_fake${++next}`
      invoices.push({ id: `inv_fake${next}`, entity: 'invoice', subscription_id: id, status: invoiceStatus, amount, currency, payment_id: paymentId, billing_start: start, billing_end: end })
      payments.set(paymentId, { id: paymentId, entity: 'payment', amount: paymentAmount, currency, status: paymentStatus, invoice_id: `inv_fake${next}`, refund_status: null })
    },
    async createSubscription(body) {
      calls.create.push(structuredClone(body))
      const subscription = { id: `sub_fake${++next}`, entity: 'subscription', plan_id: body.plan_id, status: 'created', quantity: body.quantity, paid_count: 0, start_at: body.start_at ?? null, notes: body.notes }
      if (provider.failCreate === 'rejected') { provider.failCreate = null; throw new ProviderError('Razorpay Test rejected the request: start_at is invalid', true) }
      subscriptions.set(subscription.id, subscription)
      if (provider.failCreate === 'timeout') { provider.failCreate = null; throw new ProviderError('Razorpay Test did not respond.', false) }
      return structuredClone(subscription)
    },
    async fetchSubscription(id) {
      if (provider.failReads) throw new ProviderError('Razorpay Test did not respond.', false)
      if (provider.failFetch) { provider.failFetch = null; throw new ProviderError('Razorpay Test did not respond.', false) }
      if (!subscriptions.has(id)) throw new ProviderError('Razorpay Test rejected the request: not found', true)
      return structuredClone(subscriptions.get(id))
    },
    async fetchPlan(id) { return { id, entity: 'plan', period: 'monthly', interval: 1, item: { amount, currency } } },
    async listInvoices({ subscriptionId }) { return { entity: 'collection', items: invoices.filter((item) => item.subscription_id === subscriptionId).map((item) => structuredClone(item)) } },
    async fetchPayment(id) {
      if (!payments.has(id)) throw new ProviderError('Razorpay Test rejected the request: not found', true)
      return structuredClone(payments.get(id))
    },
    async listSubscriptions({ planId }) { calls.list += 1; return { entity: 'collection', items: [...subscriptions.values()].filter((item) => item.plan_id === planId).map((item) => structuredClone(item)) } },
    /** Like Razorpay, a cycle-end stop is refused before the first paid cycle and leaves the object active until then. */
    async cancelSubscription(id, { cancelAtCycleEnd }) {
      calls.cancel.push({ id, cancelAtCycleEnd, storedBefore: provider.readStore?.() ?? null })
      if (provider.failCancel === 'rejected') { provider.failCancel = null; throw new ProviderError('Razorpay Test rejected the request: subscription cannot be cancelled', true) }
      const subscription = subscriptions.get(id)
      const paidCycle = invoices.some((item) => item.subscription_id === id && item.amount === 29900 && item.status === 'paid')
      if (cancelAtCycleEnd && !paidCycle) throw new ProviderError('Razorpay Test rejected the request: cancel at cycle end is not allowed before the first cycle', true)
      // `accepted` stands in for Razorpay accepting a stop that a read does not yet show.
      if (provider.failCancel === 'accepted') { provider.failCancel = null; return structuredClone(subscription) }
      if (cancelAtCycleEnd) subscription.cycleEndCancellation = true
      else subscription.status = 'cancelled'
      if (provider.failCancel === 'timeout') { provider.failCancel = null; throw new ProviderError('Razorpay Test did not respond.', false) }
      return structuredClone(subscription)
    },
  }
  return provider
}

function isolatedStore() {
  const folder = mkdtempSync(join(tmpdir(), 'mithra-billing-checkout-'))
  after(() => rmSync(folder, { recursive: true, force: true }))
  return join(folder, 'scenarios.json')
}

async function withHelper(options, run) {
  const helper = await open(options)
  try { return await run(helper.url) } finally { await helper.close() }
}

const prepare = (url, vendor, action, idempotencyKey) => request(url, 'POST', `/vendors/${vendor}/preparations`, { action, idempotencyKey })

test('prepares one future-start Test subscription at the original trial expiry and converges replays', async () => {
  currentTime = '2026-09-23T10:00:00.250Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const first = await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    assert.equal(first.status, 200)
    const { attempt } = first.body
    assert.equal(provider.calls.create.length, 1)
    const [created] = provider.calls.create
    assert.equal(created.plan_id, 'plan_monthly')
    assert.equal(created.start_at, Date.parse('2026-10-07T10:00:00Z') / 1000)
    assert.equal(created.addons, undefined)
    assert.equal(created.notes.md_attempt, attempt.attemptId)
    assert.deepEqual(attempt.config, { keyId: 'rzp_test_placeholder', subscriptionId: 'sub_fake1', name: 'MithraDirect', description: 'Vendor platform membership · local Razorpay Test Mode' })
    assert.deepEqual(attempt.expected, { amountMinor: 29900, currency: 'INR', chargeAt: '2026-10-07T10:00:00.250Z', authorisationAmountMinor: null })
    assert.equal(attempt.mode, 'provider')
    assert.equal(attempt.vendorId, 'trial_V')
    assert.equal(JSON.stringify(first.body).includes('local_test_placeholder'), false)

    const replay = await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    const afterReload = await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_after_reload')
    assert.equal(replay.body.attempt.config.subscriptionId, 'sub_fake1')
    assert.equal(afterReload.body.attempt.attemptId, attempt.attemptId)
    assert.equal(provider.calls.create.length, 1)
    assert.equal((await prepare(url, 'trial_V', 'pay_first_fee', 'prepare_key_1')).status, 409)
  })
  await withHelper({ file: store, provider }, async (url) => {
    const restored = (await request(url, 'GET', '/vendors/trial_V/status')).body.record
    assert.equal(restored.trialEndsAt, '2026-10-07T10:00:00.250Z')
    assert.deepEqual(restored.associations.map((item) => item.id), ['sub_fake1'])
    assert.deepEqual(restored.availableActions, ['setup_autopay'])
    assert.equal((await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_3')).body.attempt.config.subscriptionId, 'sub_fake1')
    assert.equal(provider.calls.create.length, 1)
  })
})

test('reconciles a timed-out creation after restart instead of creating another subscription', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  provider.failCreate = 'timeout'
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    const lost = await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    assert.equal(lost.status, 504)
    assert.match(lost.body.error, /never creates a second subscription/)
    assert.equal((await request(url, 'GET', '/vendors/expired_V/status')).body.record.attempts[0].state, 'provider_requested')
  })
  await withHelper({ file: store, provider }, async (url) => {
    const recovered = await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_2')
    assert.equal(recovered.status, 200)
    assert.equal(recovered.body.attempt.config.subscriptionId, 'sub_fake1')
    assert.equal(recovered.body.attempt.expected.chargeAt, null)
    assert.equal(provider.calls.create.length, 1)
    assert.equal(provider.calls.create[0].start_at, undefined)
    assert.equal(provider.calls.list, 1)
  })
})

test('holds a timed-out creation that the provider list does not show until the quiet window passes', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  const create = provider.createSubscription
  // Razorpay may commit a timed-out create late, so a first lookup can miss it.
  provider.createSubscription = async (body) => { provider.createSubscription = create; throw new ProviderError('Razorpay Test did not respond.', false) }
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    assert.equal((await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')).status, 504)
    currentTime = '2026-09-23T10:05:00Z'
    const early = await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    assert.equal(early.status, 504)
    assert.match(early.body.error, /still uncertain/)
    const pending = (await request(url, 'GET', '/vendors/expired_V/status')).body.record
    assert.equal(pending.attempts[0].requestedAt, '2026-09-23T10:00:00.000Z')
    assert.equal(provider.subscriptions.size, 0)
    currentTime = '2026-09-23T10:11:00Z'
    const settled = await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    assert.equal(settled.status, 200)
    assert.equal(provider.subscriptions.size, 1)
    assert.equal(provider.calls.list, 2)
  })
})

test('retries a definite provider rejection with the same attempt and serializes concurrent requests', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  provider.failCreate = 'rejected'
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    const rejected = await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    assert.equal(rejected.status, 502)
    assert.match(rejected.body.error, /start_at is invalid/)
    let release
    let entered
    const reached = new Promise((resolve) => { entered = resolve })
    const create = provider.createSubscription
    provider.createSubscription = async (body) => { entered(); await new Promise((resolve) => { release = resolve }); return create(body) }
    const retried = prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    await reached
    const concurrent = await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_2')
    assert.equal(concurrent.status, 409)
    assert.match(concurrent.body.error, /already in progress/)
    release()
    assert.equal((await retried).status, 200)
    assert.equal((await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_2')).body.attempt.attemptId, (await retried).body.attempt.attemptId)
    assert.equal(provider.subscriptions.size, 1)
    assert.equal((await request(url, 'GET', '/vendors/expired_V/status')).body.record.attempts.length, 1)
  })
})

test('shares one provider read between simultaneous status reads and defers only reads during a write', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    const hold = (method) => {
      const original = provider[method]
      let release
      const entered = new Promise((resolve) => {
        provider[method] = async (...args) => { resolve(); await new Promise((done) => { release = done }); provider[method] = original; return original(...args) }
      })
      return { entered, release: () => release() }
    }
    const creating = hold('createSubscription')
    const write = prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    await creating.entered
    assert.equal((await request(url, 'GET', '/vendors/expired_V/status')).body.record.providerCheck, 'deferred')
    creating.release()
    assert.equal((await write).status, 200)

    let reads = 0
    const fetchSubscription = provider.fetchSubscription
    provider.fetchSubscription = async (id) => { reads += 1; return fetchSubscription(id) }
    const reading = hold('fetchSubscription')
    // Plan and its local Test panel both read status on mount.
    const first = request(url, 'GET', '/vendors/expired_V/status')
    await reading.entered
    const second = request(url, 'GET', '/vendors/expired_V/status')
    assert.equal((await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_2')).status, 409)
    reading.release()
    const [a, b] = await Promise.all([first, second])
    assert.equal(a.body.record.providerCheck, 'current')
    assert.equal(b.body.record.providerCheck, 'current')
    assert.equal(reads, 1)
  })
})

test('blocks provider mismatches and consumed objects without creating a replacement', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const shifted = fakeProvider()
  const create = shifted.createSubscription
  shifted.createSubscription = async (body) => { const made = await create(body); shifted.subscriptions.get(made.id).start_at -= 86400; return { ...made, start_at: made.start_at - 86400 } }
  await withHelper({ file: isolatedStore(), provider: shifted }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const blocked = await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    assert.equal(blocked.status, 409)
    assert.match(blocked.body.error, /original trial expiry/)
    const record = (await request(url, 'GET', '/vendors/trial_V/status')).body.record
    assert.deepEqual(record.availableActions, [])
    assert.equal(record.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.equal((await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_2')).status, 409)
    assert.equal(shifted.calls.create.length, 1)
  })

  const dollars = fakeProvider({ currency: 'USD' })
  await withHelper({ file: isolatedStore(), provider: dollars }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    assert.match((await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')).body.error, /monthly INR plan/)
  })

  const repriced = fakeProvider({ amount: 39900 })
  await withHelper({ file: isolatedStore(), provider: repriced }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    assert.equal((await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')).body.attempt.expected.amountMinor, 39900)
  })

  const consumed = fakeProvider()
  await withHelper({ file: isolatedStore(), provider: consumed }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    consumed.subscriptions.get('sub_fake1').status = 'active'
    const stale = await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    assert.equal(stale.status, 409)
    assert.match(stale.body.error, /no longer fresh/)
    const record = (await request(url, 'GET', '/vendors/expired_V/status')).body.record
    assert.equal(record.paymentStatus, 'pending')
    // No replacement preparation; the active object can only be cancelled.
    assert.deepEqual(record.availableActions, ['cancel'])
    assert.equal(consumed.calls.create.length, 1)
  })
})

test('offers the paid scenario only AutoPay at its anchor and no after-expiry fee while trial AutoPay is uncertain', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    assert.deepEqual((await request(url, 'GET', '/vendors/paid_V/status')).body.record.availableActions, ['setup_autopay'])
    assert.equal((await prepare(url, 'paid_V', 'pay_first_fee', 'prepare_key_1')).status, 409)
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_2')
    currentTime = '2026-10-08T10:00:00Z'
    const aged = (await request(url, 'GET', '/vendors/trial_V/status')).body.record
    assert.equal(aged.accessStatus, 'TRIAL_ENDED')
    assert.deepEqual(aged.availableActions, [])
    assert.equal((await prepare(url, 'trial_V', 'pay_first_fee', 'prepare_key_3')).status, 409)
    assert.equal(provider.calls.create.length, 1)
  })
})

const secret = 'local_test_placeholder'
const sign = (paymentId, subscriptionId, key = secret) => createHmac('sha256', key).update(`${paymentId}|${subscriptionId}`).digest('hex')
const submit = (url, vendor, body) => request(url, 'POST', `/vendors/${vendor}/submissions`, body)
const status = async (url, vendor) => (await request(url, 'GET', `/vendors/${vendor}/status`)).body.record
const day = 24 * 60 * 60

test('verifies the Checkout signature against the stored subscription and records nothing for bad callbacks', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const { attempt } = (await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')).body
    const valid = { attemptId: attempt.attemptId, subscriptionId: 'sub_fake1', paymentId: 'pay_vector1', signature: '036eaca493b5d14d219150c7231a894b0ff911c67ba27ccb5f1d7806ad8fbb29' }
    const before = (await status(url, 'trial_V')).revision
    const rejected = [
      [400, { ...valid, signature: sign('pay_vector1', 'sub_fake1', 'rzp_live_other_account_secret') }],
      [400, { ...valid, paymentId: 'pay_tampered' }],
      [400, { ...valid, signature: undefined }],
      [400, { ...valid, paymentId: '' }],
      [409, { ...valid, subscriptionId: 'sub_other', signature: sign('pay_vector1', 'sub_other') }],
      [409, { ...valid, attemptId: 'lt_unknown' }],
    ]
    for (const [code, body] of rejected) assert.equal((await submit(url, 'trial_V', body)).status, code)
    assert.equal((await submit(url, 'other_V', valid)).status, 409)
    assert.equal((await status(url, 'trial_V')).revision, before)

    const accepted = await submit(url, 'trial_V', valid)
    assert.equal(accepted.status, 200)
    const record = await status(url, 'trial_V')
    assert.equal(record.attempts[0].state, 'callback_verified')
    // A valid signature authenticates the callback only; the provider object is still unauthorised.
    assert.equal(record.authorisationStatus, 'pending')
    assert.equal(record.paymentStatus, 'none')
    assert.deepEqual(record.providerVerified, { authorisation: false, payment: false, coverage: false })
    assert.deepEqual(record.availableActions, [])
    assert.equal((await submit(url, 'trial_V', valid)).body.record.revision, accepted.body.record.revision)
  })
  const saved = readFileSync(store, 'utf8')
  assert.equal(saved.includes('pay_vector1'), false)
  assert.equal(saved.includes('036eaca4'), false)
})

test('reads trial AutoPay authorisation from the provider without a callback and keeps the first fee due at the original expiry', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    const untouched = await status(url, 'trial_V')
    assert.equal(untouched.authorisationStatus, 'not_configured')
    assert.deepEqual(untouched.availableActions, ['setup_autopay'])
    assert.equal(untouched.providerCheck, 'current')
    // The customer completed Checkout, but the browser callback was lost; a refundable token charge exists.
    provider.authenticate('sub_fake1')
  })
  await withHelper({ file: store, provider }, async (url) => {
    const recovered = await status(url, 'trial_V')
    assert.equal(recovered.attempts[0].state, 'authorised')
    assert.equal(recovered.authorisationStatus, 'confirmed')
    assert.equal(recovered.paymentStatus, 'none')
    assert.deepEqual(recovered.providerVerified, { authorisation: true, payment: false, coverage: false })
    assert.equal(recovered.nextChargeAt, '2026-10-07T10:00:00.000Z')
    assert.equal(recovered.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.equal(recovered.accessStatus, 'TRIAL')
    assert.equal(recovered.paidThrough, null)
    assert.deepEqual(recovered.availableActions, ['cancel'])
    assert.equal((await status(url, 'trial_V')).revision, recovered.revision)

    currentTime = '2026-10-07T11:00:00Z'
    const due = await status(url, 'trial_V')
    assert.equal(due.accessStatus, 'TRIAL_ENDED')
    assert.equal(due.paymentStatus, 'pending')
    // The authorised trial object charges at the boundary, so no separate first fee is offered.
    assert.deepEqual(due.availableActions, ['cancel'])
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: Date.parse('2026-10-07T10:00:00Z') / 1000, end: Date.parse('2026-11-07T10:00:00Z') / 1000 })
    const paid = await status(url, 'trial_V')
    assert.equal(paid.paymentStatus, 'confirmed')
    assert.equal(paid.accessStatus, 'PAID')
    assert.equal(paid.paidThrough, '2026-11-07T10:00:00.000Z')
  })
  assert.equal(provider.calls.create.length, 1)
})

test('advances the expired signup only for a captured first fee and never counts it twice', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  const now = Date.parse(currentTime) / 1000
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    const { attempt } = (await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')).body
    provider.authenticate('sub_fake1', 'active', 0)
    const callback = { attemptId: attempt.attemptId, subscriptionId: 'sub_fake1', paymentId: 'pay_callback', signature: sign('pay_callback', 'sub_fake1') }
    assert.equal((await submit(url, 'expired_V', callback)).status, 200)
    // An active subscription alone is not a confirmed platform fee.
    const active = await status(url, 'expired_V')
    assert.equal(active.authorisationStatus, 'confirmed')
    assert.equal(active.paymentStatus, 'pending')
    assert.equal(active.accessStatus, 'TRIAL_ENDED')
    assert.equal(active.storeVisible, false)
    provider.charge('sub_fake1', { start: now, end: now + 30 * day, paymentStatus: 'authorized' })
    assert.equal((await status(url, 'expired_V')).paymentStatus, 'pending')
    provider.payments.get('pay_fake2').status = 'captured'
    const paid = await status(url, 'expired_V')
    assert.equal(paid.paymentStatus, 'confirmed')
    assert.equal(paid.accessStatus, 'PAID')
    assert.equal(paid.storeVisible, true)
    assert.equal(paid.paidThrough, '2026-10-23T10:00:00.000Z')
    assert.deepEqual(paid.providerVerified, { authorisation: true, payment: true, coverage: true })
    assert.deepEqual(paid.attempts[0].fee, { invoiceId: 'inv_fake2', paymentId: 'pay_fake2', amountMinor: 29900, currency: 'INR', periodStart: '2026-09-23T10:00:00.000Z', periodEnd: '2026-10-23T10:00:00.000Z' })

    // A duplicate or late callback and a second charge for the same period cannot add coverage.
    assert.equal((await submit(url, 'expired_V', callback)).body.record.revision, paid.revision)
    provider.charge('sub_fake1', { start: now, end: now + 30 * day })
    const again = await status(url, 'expired_V')
    assert.equal(again.paidThrough, paid.paidThrough)
    assert.equal(again.attempts[0].fee.invoiceId, 'inv_fake2')
  })
  await withHelper({ file: store, provider }, async (url) => {
    assert.equal((await status(url, 'expired_V')).paidThrough, '2026-10-23T10:00:00.000Z')
  })
})

test('refuses provider records with the wrong owner, plan, amount or billing period', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const now = Date.parse(currentTime) / 1000
  const cases = [
    ['foreign vendor note', (provider) => { provider.authenticate('sub_fake1', 'active', 0); provider.subscriptions.get('sub_fake1').notes.md_vendor = 'other_V' }, 'ownership'],
    ['plan repriced', (provider) => { provider.authenticate('sub_fake1', 'active', 0); provider.repriced = true }, 'plan'],
    ['wrong fee amount', (provider) => { provider.authenticate('sub_fake1', 'active', 0); provider.charge('sub_fake1', { start: now, end: now + 30 * day, paymentAmount: 19900 }) }, null],
    ['backdated period', (provider) => { provider.authenticate('sub_fake1', 'active', 0); provider.charge('sub_fake1', { start: now - 40 * day, end: now - 10 * day }) }, 'period'],
  ]
  for (const [name, arrange, problem] of cases) {
    const provider = fakeProvider()
    const fetchPlan = provider.fetchPlan
    provider.fetchPlan = async (id) => provider.repriced ? { ...(await fetchPlan(id)), item: { amount: 39900, currency: 'INR' } } : fetchPlan(id)
    await withHelper({ file: isolatedStore(), provider }, async (url) => {
      await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
      await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
      arrange(provider)
      const record = await status(url, 'expired_V')
      assert.notEqual(record.paymentStatus, 'confirmed', name)
      assert.equal(record.accessStatus, 'TRIAL_ENDED', name)
      assert.equal(record.paidThrough, null, name)
      if (problem) {
        assert.equal(record.attempts[0].state, 'needs_verification', name)
        assert.equal(record.attempts[0].problem, problem, name)
        assert.equal(record.authorisationStatus, 'not_configured', name)
        assert.equal(record.paymentStatus, 'pending', name)
      }
      // Only an authorised object with no recorded problem can still collect, so only it can be cancelled.
      assert.deepEqual(record.availableActions, problem ? [] : ['cancel'], name)
    })
  }
})

test('keeps results pending when provider reads fail, including after restart', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    const { attempt } = (await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')).body
    await submit(url, 'expired_V', { attemptId: attempt.attemptId, subscriptionId: 'sub_fake1', paymentId: 'pay_callback', signature: sign('pay_callback', 'sub_fake1') })
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: Date.parse(currentTime) / 1000, end: Date.parse(currentTime) / 1000 + 30 * day })
    provider.failReads = true
    const unavailable = await status(url, 'expired_V')
    assert.equal(unavailable.providerCheck, 'unavailable')
    assert.equal(unavailable.paymentStatus, 'pending')
    assert.equal(unavailable.accessStatus, 'TRIAL_ENDED')
    assert.deepEqual(unavailable.availableActions, [])
  })
  await withHelper({ file: store, provider }, async (url) => {
    assert.equal((await status(url, 'expired_V')).paymentStatus, 'pending')
    provider.failReads = false
    assert.equal((await status(url, 'expired_V')).paymentStatus, 'confirmed')
  })
  assert.equal(readFileSync(store, 'utf8').includes('did not respond'), false)
})

test('permits a separate first fee after expiry only once the trial AutoPay object is closed at the provider', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    currentTime = '2026-10-08T10:00:00Z'
    assert.deepEqual((await status(url, 'trial_V')).availableActions, [])
    provider.subscriptions.get('sub_fake1').status = 'expired'
    const closed = await status(url, 'trial_V')
    assert.equal(closed.attempts[0].state, 'provider_closed')
    assert.equal(closed.authorisationStatus, 'failed')
    assert.deepEqual(closed.availableActions, ['pay_first_fee'])
    const fee = await prepare(url, 'trial_V', 'pay_first_fee', 'prepare_key_2')
    assert.equal(fee.status, 200)
    assert.equal(fee.body.attempt.config.subscriptionId, 'sub_fake2')
    assert.equal(fee.body.attempt.expected.chargeAt, null)
  })
})

test('treats retrying, halted or paused collection as unconfirmed and keeps rereading it', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    for (const providerStatus of ['pending', 'halted', 'paused']) {
      provider.subscriptions.get('sub_fake1').status = providerStatus
      const record = await status(url, 'expired_V')
      assert.equal(record.attempts[0].state, 'provider_pending', providerStatus)
      assert.equal(record.authorisationStatus, 'not_configured', providerStatus)
      assert.equal(record.paymentStatus, 'pending', providerStatus)
      assert.deepEqual(record.providerVerified, { authorisation: false, payment: false, coverage: false }, providerStatus)
      // Nothing new is prepared; the object may still collect, so it can only be cancelled.
      assert.deepEqual(record.availableActions, ['cancel'], providerStatus)
    }
    provider.authenticate('sub_fake1', 'active', 0)
    assert.equal((await status(url, 'expired_V')).authorisationStatus, 'confirmed')
  })
})

test('counts only the first monthly ₹299 invoice and keeps a mismatch final', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const now = Date.parse(currentTime) / 1000
  const failedFirst = fakeProvider()
  await withHelper({ file: isolatedStore(), provider: failedFirst }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    failedFirst.authenticate('sub_fake1', 'active', 0)
    failedFirst.charge('sub_fake1', { start: now, end: now + 30 * day, invoiceStatus: 'issued', paymentStatus: 'failed' })
    failedFirst.charge('sub_fake1', { start: now + 30 * day, end: now + 60 * day })
    const record = await status(url, 'expired_V')
    assert.equal(record.paymentStatus, 'pending')
    assert.equal(record.paidThrough, null)
  })

  const longPeriod = fakeProvider()
  await withHelper({ file: isolatedStore(), provider: longPeriod }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    longPeriod.authenticate('sub_fake1', 'active', 0)
    longPeriod.charge('sub_fake1', { start: now, end: now + 90 * day })
    assert.equal((await status(url, 'expired_V')).attempts[0].problem, 'period')
  })

  const repriced = fakeProvider({ amount: 39900 })
  await withHelper({ file: isolatedStore(), provider: repriced }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    repriced.authenticate('sub_fake1', 'active', 0)
    repriced.charge('sub_fake1', { amount: 39900, start: now, end: now + 30 * day })
    const record = await status(url, 'expired_V')
    assert.equal(record.attempts[0].problem, 'plan')
    assert.notEqual(record.accessStatus, 'PAID')
  })

  const foreign = fakeProvider()
  await withHelper({ file: isolatedStore(), provider: foreign }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    foreign.authenticate('sub_fake1', 'active', 0)
    foreign.subscriptions.get('sub_fake1').notes.md_vendor = 'other_V'
    assert.equal((await status(url, 'expired_V')).attempts[0].problem, 'ownership')
    foreign.subscriptions.get('sub_fake1').notes.md_vendor = 'expired_V'
    foreign.charge('sub_fake1', { start: now, end: now + 30 * day })
    const record = await status(url, 'expired_V')
    assert.equal(record.attempts[0].state, 'needs_verification')
    assert.equal(record.paymentStatus, 'pending')
  })
})

const at = (iso) => Date.parse(iso) / 1000 // Unix seconds, as Razorpay reports billing periods
const anchor = '2026-10-23T10:00:00.000Z'
const second = '2026-11-23T10:00:00.000Z'
const third = '2026-12-23T10:00:00.000Z'

/** A Test Dashboard retry on the same invoice: a new captured payment settles it. */
function retryInvoice(provider, invoiceId) {
  const invoice = provider.invoices.find((item) => item.id === invoiceId)
  const paymentId = `${invoice.payment_id}_retry`
  provider.payments.set(paymentId, { id: paymentId, entity: 'payment', amount: invoice.amount, currency: 'INR', status: 'captured', invoice_id: invoice.id, refund_status: null })
  Object.assign(invoice, { status: 'paid', payment_id: paymentId })
}

test('gives the paid scenario its own future-start subscription at the sample paid-through anchor', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    const prepared = await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    assert.equal(prepared.status, 200)
    assert.equal(provider.calls.create[0].start_at, at(anchor))
    assert.equal(provider.calls.create[0].notes.md_scenario, 'paid_sample')
    assert.equal(prepared.body.attempt.expected.chargeAt, anchor)
    provider.authenticate('sub_fake1')
    const authorised = await status(url, 'paid_V')
    assert.equal(authorised.authorisationStatus, 'confirmed')
    assert.equal(authorised.paymentStatus, 'none')
    assert.equal(authorised.accessStatus, 'PAID')
    assert.equal(authorised.paidThrough, anchor)
    assert.equal(authorised.nextChargeAt, anchor)
    assert.deepEqual(authorised.availableActions, ['cancel'])
    assert.equal((await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_2')).status, 409)
  })
  assert.equal(provider.calls.create.length, 1)
})

test('reads accelerated renewal success, pending, failure and retry against the original cycle, surviving restart', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1')
    // Test Dashboard "Charge this now" collects the anchor cycle a month early; coverage follows the invoice period.
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at(anchor), end: at(second) })
    const renewed = await status(url, 'paid_V')
    assert.equal(renewed.paymentStatus, 'confirmed')
    assert.equal(renewed.paidThrough, second)
    assert.equal(renewed.nextChargeAt, second)
    assert.equal(renewed.accessStatus, 'PAID')
    assert.deepEqual(renewed.providerVerified, { authorisation: true, payment: true, coverage: true })

    // The next accelerated charge is issued but not settled: pending, then failed while Razorpay retries.
    provider.charge('sub_fake1', { start: at(second), end: at(third), invoiceStatus: 'issued', paymentStatus: 'failed' })
    const pending = await status(url, 'paid_V')
    assert.equal(pending.paymentStatus, 'pending')
    assert.equal(pending.paidThrough, second)
    assert.equal(pending.nextChargeAt, second)
    assert.equal(pending.accessStatus, 'PAID')
    provider.subscriptions.get('sub_fake1').status = 'pending'
    const failed = await status(url, 'paid_V')
    assert.equal(failed.paymentStatus, 'failed')
    assert.equal(failed.accessStatus, 'PAID')
    assert.equal(failed.paidThrough, second)
    // A stale read showing the subscription active again cannot roll the failure back to pending.
    provider.subscriptions.get('sub_fake1').status = 'active'
    assert.equal((await status(url, 'paid_V')).paymentStatus, 'failed')
    provider.subscriptions.get('sub_fake1').status = 'pending'
  })

  currentTime = '2026-11-23T10:00:01Z'
  await withHelper({ file: store, provider }, async (url) => {
    // At the local boundary the failed fee restricts the demonstration with no grace.
    const lapsed = await status(url, 'paid_V')
    assert.equal(lapsed.accessStatus, 'PAYMENT_REQUIRED')
    assert.equal(lapsed.storeVisible, false)
    assert.equal(lapsed.paymentStatus, 'failed')
    assert.equal(lapsed.paidThrough, second)
    assert.equal(lapsed.nextChargeAt, second)
    assert.deepEqual(lapsed.availableActions, ['cancel'])

    // The retry two days later settles the same invoice and restores only the original cycle's remainder.
    currentTime = '2026-11-25T10:00:00Z'
    retryInvoice(provider, 'inv_fake4')
    provider.subscriptions.get('sub_fake1').status = 'active'
    const recovered = await status(url, 'paid_V')
    assert.equal(recovered.paymentStatus, 'confirmed')
    assert.equal(recovered.accessStatus, 'PAID')
    assert.equal(recovered.paidThrough, third)
    assert.equal(recovered.nextChargeAt, third)
    assert.deepEqual(recovered.attempts[0].renewals.map((item) => [item.invoiceId, item.periodStart, item.periodEnd]), [['inv_fake4', second, third]])
    assert.equal(recovered.attempts[0].renewal, null)
  })

  await withHelper({ file: store, provider }, async (url) => {
    const restored = await status(url, 'paid_V')
    assert.equal(restored.paidThrough, third)
    assert.equal(restored.attempts[0].fee.periodStart, anchor)
    assert.deepEqual(restored.associations.map((item) => item.id), ['sub_fake1'])
  })
  assert.equal(provider.calls.create.length, 1)
  const saved = readFileSync(store, 'utf8')
  assert.equal(saved.includes('local_test_placeholder'), false)
})

test('never counts a duplicate, shifted or stale renewal read and never rolls coverage back', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at(anchor), end: at(second) })
    provider.charge('sub_fake1', { start: at(second), end: at(third) })
    assert.equal((await status(url, 'paid_V')).paidThrough, third)
    // After the first fee, a charge whose period starts at charge time is not an original cycle and moves nothing.
    provider.charge('sub_fake1', { start: at(currentTime), end: at(currentTime) + 30 * day })
    const first = await status(url, 'paid_V')
    assert.equal(first.paidThrough, third)
    assert.equal(first.attempts[0].renewals.length, 1)
    assert.equal(first.attempts[0].renewal.problem, 'uncounted')
    const revision = first.revision

    // Repeated reads and a duplicate paid invoice for an already-counted cycle change nothing.
    provider.charge('sub_fake1', { start: at(second), end: at(third) })
    const repeated = await status(url, 'paid_V')
    assert.equal(repeated.paidThrough, third)
    assert.equal(repeated.attempts[0].renewals.length, 1)
    assert.equal((await status(url, 'paid_V')).revision, repeated.revision)
    assert.ok(repeated.revision >= revision)

    // A stale invoice list missing the counted renewal cannot roll coverage back.
    const invoices = provider.invoices.splice(0)
    const stale = await status(url, 'paid_V')
    assert.equal(stale.paidThrough, third)
    assert.equal(stale.paymentStatus, 'confirmed')
    provider.invoices.push(...invoices)

    // A paid invoice without a captured payment, or an unknown provider status, stays pending rather than paid.
    provider.charge('sub_fake1', { start: at(third), end: at('2027-01-23T10:00:00Z'), paymentStatus: 'authorized' })
    provider.subscriptions.get('sub_fake1').status = 'unrecognised'
    const unknown = await status(url, 'paid_V')
    assert.equal(unknown.paymentStatus, 'pending')
    assert.equal(unknown.paidThrough, third)
    provider.failReads = true
    const unavailable = await status(url, 'paid_V')
    assert.equal(unavailable.providerCheck, 'unavailable')
    assert.equal(unavailable.paymentStatus, 'pending')
    assert.equal(unavailable.paidThrough, third)
  })
})

test('keeps confirmed coverage when AutoPay is revoked and never reopens it from a stale read', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at(anchor), end: at(second) })
    await status(url, 'paid_V')
    provider.subscriptions.get('sub_fake1').status = 'cancelled'
    const revoked = await status(url, 'paid_V')
    assert.equal(revoked.authorisationStatus, 'revoked')
    assert.equal(revoked.paymentStatus, 'confirmed')
    assert.equal(revoked.paidThrough, second)
    assert.equal(revoked.accessStatus, 'PAID')
    assert.equal(revoked.nextChargeAt, null)
    assert.equal(revoked.attempts[0].providerStatus, 'cancelled')
    provider.subscriptions.get('sub_fake1').status = 'active'
    assert.equal((await status(url, 'paid_V')).authorisationStatus, 'revoked')
  })
  currentTime = '2026-11-24T10:00:00Z'
  await withHelper({ file: store, provider }, async (url) => {
    const ended = await status(url, 'paid_V')
    assert.equal(ended.authorisationStatus, 'revoked')
    assert.equal(ended.accessStatus, 'PAYMENT_REQUIRED')
    assert.equal(ended.paymentStatus, 'confirmed')
    assert.equal(ended.paidThrough, second)
    assert.equal(ended.nextChargeAt, null)
  })
})

test('an accelerated trial charge never moves the original trial expiry', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at('2026-10-07T10:00:00Z'), end: at('2026-11-07T10:00:00Z') })
    const charged = await status(url, 'trial_V')
    assert.equal(charged.paymentStatus, 'confirmed')
    assert.equal(charged.accessStatus, 'TRIAL')
    assert.equal(charged.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.equal(charged.daysRemaining, 14)
    assert.equal(charged.paidThrough, '2026-11-07T10:00:00.000Z')
    assert.equal(charged.nextChargeAt, '2026-11-07T10:00:00.000Z')
  })
})

test('keeps provider-verified coverage labelled past the boundary and reads collection health after a fee', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at(anchor), end: at(second) })
    assert.deepEqual((await status(url, 'paid_V')).providerVerified, { authorisation: true, payment: true, coverage: true })
    const cases = [['pending', 'confirmed'], ['halted', 'failed'], ['paused', 'pending'], ['unrecognised', 'pending'], ['active', 'confirmed']]
    for (const [providerStatus, authorisation] of cases) {
      provider.subscriptions.get('sub_fake1').status = providerStatus
      assert.equal((await status(url, 'paid_V')).authorisationStatus, authorisation, providerStatus)
    }
    // Past the boundary with no renewal invoice yet, the due fee is local simulation but the ended period is still Razorpay's.
    currentTime = '2026-11-23T10:00:01Z'
    const lapsed = await status(url, 'paid_V')
    assert.equal(lapsed.paymentStatus, 'pending')
    assert.deepEqual(lapsed.providerVerified, { authorisation: true, payment: false, coverage: true })
    currentTime = '2026-09-23T10:00:00Z'
    // A finished Test schedule is not a revocation: authorisation stays as observed and nothing further is scheduled.
    provider.subscriptions.get('sub_fake1').status = 'completed'
    const completed = await status(url, 'paid_V')
    assert.equal(completed.authorisationStatus, 'confirmed')
    assert.equal(completed.nextChargeAt, null)
    assert.equal(completed.paidThrough, second)
    provider.subscriptions.get('sub_fake1').status = 'active'
    assert.equal((await status(url, 'paid_V')).attempts[0].providerStatus, 'completed')
  })
})

const cancel = (url, vendor, idempotencyKey) => request(url, 'POST', `/vendors/${vendor}/cancellations`, { idempotencyKey })
const savedCancellation = (store, vendor) => JSON.parse(readFileSync(store, 'utf8')).vendors[vendor].attempts.find((item) => item.cancellation)?.cancellation ?? null

test('stops trial AutoPay immediately, confirms it only from a provider read and rejoins at the same trial expiry', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  provider.readStore = () => savedCancellation(store, 'trial_V')
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    // An ordinary trial with no collection agreement has nothing to cancel.
    assert.deepEqual((await status(url, 'trial_V')).availableActions, ['setup_autopay'])
    assert.equal((await cancel(url, 'trial_V', 'cancel_key_1')).status, 409)
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1')
    const authorised = await status(url, 'trial_V')
    assert.deepEqual(authorised.availableActions, ['cancel'])
    assert.equal(authorised.cancellation, null)

    const acknowledged = await cancel(url, 'trial_V', 'cancel_key_1')
    assert.equal(acknowledged.status, 200)
    // The request and its association were durable before Razorpay was asked, and pre-first-fee is an immediate stop.
    assert.deepEqual(provider.calls.cancel.map(({ id, cancelAtCycleEnd }) => [id, cancelAtCycleEnd]), [['sub_fake1', false]])
    assert.equal(provider.calls.cancel[0].storedBefore.state, 'requested')
    assert.equal(provider.calls.cancel[0].storedBefore.associationId, 'sub_fake1')
    // An acknowledgement is not confirmation: collection is not yet claimed stopped.
    const ack = acknowledged.body.record
    assert.deepEqual(ack.cancellation, { status: 'requested', stage: 'acknowledged', mode: 'immediate', requestedAt: '2026-09-23T10:00:00.000Z', effectiveAt: null })
    assert.equal(ack.authorisationStatus, 'confirmed')
    assert.equal(ack.nextChargeAt, '2026-10-07T10:00:00.000Z')
    assert.deepEqual(ack.availableActions, [])

    currentTime = '2026-09-24T10:00:00Z'
    const confirmed = await status(url, 'trial_V')
    assert.deepEqual(confirmed.cancellation, { status: 'confirmed', stage: 'confirmed', mode: 'immediate', requestedAt: '2026-09-23T10:00:00.000Z', effectiveAt: '2026-09-24T10:00:00.000Z' })
    assert.equal(confirmed.authorisationStatus, 'revoked')
    assert.equal(confirmed.nextChargeAt, null)
    assert.equal(confirmed.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.equal(confirmed.accessStatus, 'TRIAL')
    assert.equal(confirmed.daysRemaining, 13)
    assert.equal(confirmed.paymentStatus, 'none')
    assert.deepEqual(confirmed.availableActions, ['setup_autopay'])

    // Duplicate requests under the same or a reloaded key converge without another provider call.
    assert.equal((await cancel(url, 'trial_V', 'cancel_key_1')).body.record.cancellation.status, 'confirmed')
    assert.equal((await cancel(url, 'trial_V', 'cancel_key_2')).body.record.cancellation.status, 'confirmed')
    assert.equal(provider.calls.cancel.length, 1)
    // A stale active read cannot undo a confirmed stop.
    provider.subscriptions.get('sub_fake1').status = 'active'
    assert.equal((await status(url, 'trial_V')).cancellation.status, 'confirmed')
  })

  await withHelper({ file: store, provider }, async (url) => {
    assert.equal((await status(url, 'trial_V')).cancellation.status, 'confirmed')
    // The page's earlier key never reopens the cancelled object: rejoining prepares one new object at the same
    // expiry, and a replayed or reloaded key converges on it.
    const rejoin = await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    assert.equal((await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')).body.attempt.attemptId, rejoin.body.attempt.attemptId)
    assert.equal((await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_3')).body.attempt.attemptId, rejoin.body.attempt.attemptId)
    assert.equal(rejoin.status, 200)
    assert.equal(rejoin.body.attempt.config.subscriptionId, 'sub_fake3')
    assert.equal(rejoin.body.attempt.expected.chargeAt, '2026-10-07T10:00:00.000Z')
    assert.equal(provider.calls.create.at(-1).start_at, at('2026-10-07T10:00:00Z'))
    const replaced = rejoin.body.record
    // The new agreement clears the current cancellation label; history keeps the old one.
    assert.equal(replaced.cancellation, null)
    assert.equal(replaced.attempts[0].cancellation.state, 'confirmed')
    assert.equal(replaced.trialEndsAt, '2026-10-07T10:00:00.000Z')
    assert.equal(replaced.daysRemaining, 13)
    provider.authenticate('sub_fake3')
    const rejoined = await status(url, 'trial_V')
    assert.equal(rejoined.authorisationStatus, 'confirmed')
    assert.equal(rejoined.nextChargeAt, '2026-10-07T10:00:00.000Z')
    assert.equal(rejoined.cancellation, null)
    assert.deepEqual(rejoined.availableActions, ['cancel'])
  })
  assert.equal(provider.calls.create.length, 2)
})

test('schedules a paid-cycle stop at the paid-through date, keeps it distinct from terminal cancellation and withholds replacement meanwhile', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at(anchor), end: at(second) })
    assert.deepEqual((await status(url, 'paid_V')).availableActions, ['cancel'])
    const scheduled = (await cancel(url, 'paid_V', 'cancel_key_1')).body.record
    assert.deepEqual(provider.calls.cancel.map(({ cancelAtCycleEnd }) => cancelAtCycleEnd), [true])
    assert.deepEqual(scheduled.cancellation, { status: 'scheduled', stage: 'scheduled', mode: 'cycle_end', requestedAt: '2026-09-23T10:00:00.000Z', effectiveAt: second })
    // Razorpay keeps the object active until the cycle ends; that is still only a scheduled stop.
    const active = await status(url, 'paid_V')
    assert.equal(active.cancellation.status, 'scheduled')
    assert.equal(active.authorisationStatus, 'confirmed')
    assert.equal(active.paymentStatus, 'confirmed')
    assert.equal(active.accessStatus, 'PAID')
    assert.equal(active.paidThrough, second)
    assert.equal(active.nextChargeAt, null)
    assert.deepEqual(active.availableActions, [])
    assert.equal((await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_2')).status, 409)
    assert.equal((await cancel(url, 'paid_V', 'cancel_key_2')).body.record.cancellation.status, 'scheduled')
    assert.equal(provider.calls.cancel.length, 1)
  })

  // The operator ends the object in the Test Dashboard while paid coverage remains; the next read confirms it.
  provider.subscriptions.get('sub_fake1').status = 'cancelled'
  currentTime = '2026-10-01T10:00:00Z'
  await withHelper({ file: store, provider }, async (url) => {
    const confirmed = await status(url, 'paid_V')
    // Observed stopped before its scheduled date, it is effective no later than that read.
    assert.deepEqual(confirmed.cancellation, { status: 'confirmed', stage: 'confirmed', mode: 'cycle_end', requestedAt: '2026-09-23T10:00:00.000Z', effectiveAt: '2026-10-01T10:00:00.000Z' })
    assert.equal(confirmed.authorisationStatus, 'revoked')
    assert.equal(confirmed.paymentStatus, 'confirmed')
    assert.equal(confirmed.paidThrough, second)
    assert.deepEqual(confirmed.availableActions, ['setup_autopay'])
    // A stale active read cannot undo the confirmed stop.
    provider.subscriptions.get('sub_fake1').status = 'active'
    assert.equal((await status(url, 'paid_V')).cancellation.status, 'confirmed')
    // Rejoining starts at the verified paid-through date, not the sample anchor: no duplicate fee.
    const rejoin = await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_3')
    assert.equal(rejoin.body.attempt.expected.chargeAt, second)
    assert.equal(provider.calls.create.at(-1).start_at, at(second))
    assert.equal(rejoin.body.record.cancellation, null)
    provider.authenticate('sub_fake3')
    const pending = await status(url, 'paid_V')
    assert.equal(pending.authorisationStatus, 'confirmed')
    assert.equal(pending.paymentStatus, 'confirmed')
    assert.equal(pending.nextChargeAt, second)
    assert.equal(pending.paidThrough, second)
    // The replacement's first fee continues the original cycle.
    provider.authenticate('sub_fake3', 'active', 0)
    provider.charge('sub_fake3', { start: at(second), end: at(third) })
    const renewed = await status(url, 'paid_V')
    assert.equal(renewed.paidThrough, third)
    assert.equal(renewed.nextChargeAt, third)
    assert.equal(renewed.cancellation, null)
    assert.deepEqual(renewed.availableActions, ['cancel'])
  })
  assert.equal(provider.calls.create.length, 2)
})

test('reconciles a timed-out or rejected cancellation after restart and never claims collection stopped meanwhile', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1')
    await status(url, 'trial_V')
    provider.failCancel = 'rejected'
    const rejected = await cancel(url, 'trial_V', 'cancel_key_1')
    assert.equal(rejected.status, 502)
    assert.match(rejected.body.error, /rejected/)
    const failed = await status(url, 'trial_V')
    assert.equal(failed.cancellation.status, 'failed')
    assert.equal(failed.authorisationStatus, 'confirmed')
    assert.equal(failed.nextChargeAt, '2026-10-07T10:00:00.000Z')
    assert.deepEqual(failed.availableActions, ['cancel'])

    // The request lands at Razorpay but its response is lost.
    provider.subscriptions.get('sub_fake1').status = 'active'
    provider.failCancel = 'timeout'
    const lost = await cancel(url, 'trial_V', 'cancel_key_2')
    assert.equal(lost.status, 504)
    assert.match(lost.body.error, /not shown as stopped/)
  })
  await withHelper({ file: store, provider }, async (url) => {
    const uncertain = JSON.parse(readFileSync(store, 'utf8')).vendors.trial_V.attempts[0]
    assert.equal(uncertain.cancellation.state, 'requested')
    // Restart reconciles from the provider read; no second request is needed.
    const confirmed = await status(url, 'trial_V')
    assert.equal(confirmed.cancellation.status, 'confirmed')
    assert.equal(confirmed.cancellation.requestedAt, '2026-09-23T10:00:00.000Z')
  })
  assert.equal(provider.calls.cancel.length, 2)
})

test('retries an unanswered cancellation for the same agreement and withholds any replacement while collection is uncertain', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1')
    await status(url, 'paid_V')
    // Razorpay never saw the request: the object is still active and can collect at the anchor.
    provider.failCancel = 'timeout'
    provider.cancelSubscription = async function (id, options) {
      provider.calls.cancel.push({ id, ...options })
      if (provider.failCancel === 'timeout') { provider.failCancel = null; throw new ProviderError('Razorpay Test did not respond.', false) }
      provider.subscriptions.get(id).status = 'cancelled'
      return structuredClone(provider.subscriptions.get(id))
    }
    assert.equal((await cancel(url, 'paid_V', 'cancel_key_1')).status, 504)
  })
  await withHelper({ file: store, provider }, async (url) => {
    const uncertain = await status(url, 'paid_V')
    assert.equal(uncertain.cancellation.status, 'requested')
    assert.equal(uncertain.cancellation.stage, 'requested')
    assert.equal(uncertain.nextChargeAt, anchor)
    assert.equal(uncertain.authorisationStatus, 'confirmed')
    // Only the same cancellation may be retried; no second chargeable agreement can be prepared.
    assert.deepEqual(uncertain.availableActions, ['cancel'])
    assert.equal((await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_2')).status, 409)
    const retried = await cancel(url, 'paid_V', 'cancel_key_2')
    assert.equal(retried.status, 200)
    assert.equal(retried.body.record.cancellation.stage, 'acknowledged')
    assert.equal(retried.body.record.cancellation.requestedAt, '2026-09-23T10:00:00.000Z')
    const confirmed = await status(url, 'paid_V')
    assert.equal(confirmed.cancellation.status, 'confirmed')
    // Pre-first-fee paid sample: immediate stop, sample coverage untouched, rejoin at the same anchor.
    assert.equal(confirmed.paidThrough, anchor)
    assert.equal(confirmed.accessStatus, 'PAID')
    assert.deepEqual(confirmed.availableActions, ['setup_autopay'])
    assert.equal((await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_3')).body.attempt.expected.chargeAt, anchor)
  })
  assert.deepEqual(provider.calls.cancel.map(({ cancelAtCycleEnd }) => cancelAtCycleEnd), [false, false])
  assert.equal(provider.calls.create.length, 2)
})

test('cancels only the helper-created object for this vendor and never a foreign or unconfirmed one', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    // A prepared but unauthorised object is not an agreement to cancel.
    assert.equal((await cancel(url, 'trial_V', 'cancel_key_1')).status, 409)
    provider.authenticate('sub_fake1')
    await status(url, 'trial_V')
    // The provider object now claims another vendor: the helper refuses to mutate it.
    provider.subscriptions.get('sub_fake1').notes.md_vendor = 'other_vendor'
    assert.equal((await cancel(url, 'trial_V', 'cancel_key_1')).status, 409)
    assert.equal(provider.calls.cancel.length, 0)
    assert.equal((await cancel(url, 'nobody', 'cancel_key_1')).status, 409)
    assert.equal((await cancel(url, 'trial_V', 'bad')).status, 400)
  })
})

test('an external revocation is not reported as a helper cancellation', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1')
    await status(url, 'trial_V')
    provider.subscriptions.get('sub_fake1').status = 'cancelled'
    const revoked = await status(url, 'trial_V')
    assert.equal(revoked.cancellation, null)
    assert.equal(revoked.authorisationStatus, 'failed')
    // The closed object cannot collect, so AutoPay can be set up again at the same expiry.
    assert.deepEqual(revoked.availableActions, ['setup_autopay'])
  })
})

test('stops a lapsed paid agreement immediately because no paid cycle remains to finish', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at(anchor), end: at(second) })
    await status(url, 'paid_V')
    provider.subscriptions.get('sub_fake1').status = 'pending'
    currentTime = '2026-11-24T10:00:00Z'
    const lapsed = await status(url, 'paid_V')
    assert.equal(lapsed.accessStatus, 'PAYMENT_REQUIRED')
    assert.deepEqual(lapsed.availableActions, ['cancel'])
    const requested = (await cancel(url, 'paid_V', 'cancel_key_1')).body.record
    assert.equal(requested.cancellation.mode, 'immediate')
    assert.deepEqual(provider.calls.cancel.map(({ cancelAtCycleEnd }) => cancelAtCycleEnd), [false])
    const confirmed = await status(url, 'paid_V')
    assert.equal(confirmed.cancellation.status, 'confirmed')
    assert.equal(confirmed.paidThrough, second)
    assert.equal(confirmed.accessStatus, 'PAYMENT_REQUIRED')
    // Rejoining is offered only during retained coverage; lapsed coverage waits for the guarded reset.
    assert.deepEqual(confirmed.availableActions, [])
  })
})

test('a replayed cancellation key converges on its own agreement and never cancels a later replacement', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1')
    await status(url, 'trial_V')
    await cancel(url, 'trial_V', 'cancel_key_1')
    await status(url, 'trial_V')
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_2')
    provider.authenticate('sub_fake3')
    assert.deepEqual((await status(url, 'trial_V')).availableActions, ['cancel'])
    const replayed = await cancel(url, 'trial_V', 'cancel_key_1')
    assert.equal(replayed.status, 200)
    assert.equal(replayed.body.record.cancellation, null)
    assert.equal(provider.calls.cancel.length, 1)
    assert.equal(provider.subscriptions.get('sub_fake3').status, 'authenticated')
  })
})

test('cancels an object still retrying its first charge, since Razorpay may yet collect', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/expired_V/scenario', { scenario: 'expired_trial' })
    await prepare(url, 'expired_V', 'pay_first_fee', 'prepare_key_1')
    provider.subscriptions.get('sub_fake1').status = 'pending'
    assert.deepEqual((await status(url, 'expired_V')).availableActions, ['cancel'])
    await cancel(url, 'expired_V', 'cancel_key_1')
    assert.deepEqual(provider.calls.cancel.map(({ cancelAtCycleEnd }) => cancelAtCycleEnd), [false])
    assert.equal((await status(url, 'expired_V')).cancellation.status, 'confirmed')
  })
})

test('a rejected retry after an unanswered request stays uncertain, and a closure after a rejection is an external revocation', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const provider = fakeProvider()
  await withHelper({ file: isolatedStore(), provider }, async (url) => {
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate('sub_fake1', 'active', 0)
    provider.charge('sub_fake1', { start: at(anchor), end: at(second) })
    await status(url, 'paid_V')
    // The cycle-end stop lands but its response is lost; Razorpay then refuses the repeated request.
    provider.failCancel = 'timeout'
    assert.equal((await cancel(url, 'paid_V', 'cancel_key_1')).status, 504)
    provider.failCancel = 'rejected'
    const retried = await cancel(url, 'paid_V', 'cancel_key_1')
    assert.equal(retried.status, 504)
    const uncertain = await status(url, 'paid_V')
    assert.equal(uncertain.cancellation.status, 'requested')
    assert.equal((await prepare(url, 'paid_V', 'setup_autopay', 'prepare_key_2')).status, 409)
  })

  const rejectedFirst = fakeProvider()
  await withHelper({ file: isolatedStore(), provider: rejectedFirst }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    rejectedFirst.authenticate('sub_fake1')
    await status(url, 'trial_V')
    rejectedFirst.failCancel = 'rejected'
    assert.equal((await cancel(url, 'trial_V', 'cancel_key_1')).status, 502)
    rejectedFirst.subscriptions.get('sub_fake1').status = 'cancelled'
    const revoked = await status(url, 'trial_V')
    assert.equal(revoked.cancellation, null)
    assert.equal(revoked.attempts[0].cancellation.state, 'failed')
    assert.deepEqual(revoked.availableActions, ['setup_autopay'])
  })
})

const reset = (url, vendor, body) => request(url, 'POST', `/vendors/${vendor}/resets`, { idempotencyKey: 'reset_key_1', ...body })
const statusBody = async (url, vendor) => (await request(url, 'GET', `/vendors/${vendor}/status`)).body
const savedReset = (store, vendor) => JSON.parse(readFileSync(store, 'utf8')).vendors[vendor]?.reset ?? null
const subscriptionOf = async (url, vendor, action, key) => (await prepare(url, vendor, action, key)).body.attempt.config.subscriptionId

test('resets a scenario with no provider objects into history and allows only an explicitly chosen fresh generation', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    const selected = (await request(url, 'POST', '/vendors/reset_V/scenario', { scenario: 'active_trial' })).body.record
    assert.equal(selected.generation, 1)
    // The confirmation must name the current scenario and generation.
    assert.equal((await reset(url, 'reset_V', { scenario: 'expired_trial', generation: 1 })).status, 409)
    assert.equal((await reset(url, 'reset_V', { scenario: 'active_trial', generation: 2 })).status, 409)
    assert.equal((await reset(url, 'reset_V', { scenario: 'active_trial' })).status, 400)
    assert.equal((await reset(url, 'other_V', { scenario: 'active_trial', generation: 1 })).status, 409)

    currentTime = '2026-09-24T10:00:00Z'
    const done = await reset(url, 'reset_V', { scenario: 'active_trial', generation: 1 })
    assert.equal(done.status, 200)
    assert.equal(done.body.record, null)
    assert.deepEqual(done.body.history.map(({ generation, scenario, selectedAt, trialEndsAt, resetRequestedAt, resetCompletedAt, objects }) => ({ generation, scenario, selectedAt, trialEndsAt, resetRequestedAt, resetCompletedAt, objects })), [{
      generation: 1, scenario: 'active_trial', selectedAt: '2026-09-23T10:00:00.000Z', trialEndsAt: '2026-10-07T10:00:00.000Z',
      resetRequestedAt: '2026-09-24T10:00:00.000Z', resetCompletedAt: '2026-09-24T10:00:00.000Z', objects: [],
    }])
    assert.equal(provider.calls.cancel.length + provider.calls.create.length + provider.calls.list, 0)

    // Reading after reset never creates a replacement; the operator chooses the next generation.
    const after = await statusBody(url, 'reset_V')
    assert.equal(after.record, null)
    assert.equal(after.history.length, 1)
    // A repeated confirmation of the completed reset converges on it.
    assert.equal((await reset(url, 'reset_V', { scenario: 'active_trial', generation: 1 })).status, 200)
    const fresh = (await request(url, 'POST', '/vendors/reset_V/scenario', { scenario: 'paid_sample' })).body.record
    assert.equal(fresh.generation, 2)
    assert.equal(fresh.paidThrough, '2026-10-24T10:00:00.000Z')
    // A late repeat of generation 1's confirmation never resets generation 2.
    const repeated = await reset(url, 'reset_V', { scenario: 'active_trial', generation: 1 })
    assert.equal(repeated.status, 200)
    assert.equal(repeated.body.record.generation, 2)
    assert.equal(repeated.body.record.reset, undefined)
    assert.equal((await statusBody(url, 'reset_V')).history.length, 1)
    // History and current state stay with their vendor.
    assert.deepEqual((await statusBody(url, 'other_V')), { record: null, history: [] })
  })
})

test('cancels active, future-start and fee-confirmed objects immediately, confirms each by a read and keeps scrubbed history', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  provider.readStore = () => savedReset(store, 'paid_V')
  await withHelper({ file: store, provider }, async (url) => {
    // A trial with a future-start AutoPay object that was never authorised.
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const future = await subscriptionOf(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    // A paid sample with a captured fee and a scheduled cycle-end stop that leaves the object active.
    await request(url, 'POST', '/vendors/paid_V/scenario', { scenario: 'paid_sample' })
    const paid = await subscriptionOf(url, 'paid_V', 'setup_autopay', 'prepare_key_2')
    provider.authenticate(paid, 'active', 0)
    provider.charge(paid, { start: at(anchor), end: at(second) })
    await status(url, 'paid_V')
    assert.equal((await cancel(url, 'paid_V', 'cancel_key_1')).body.record.cancellation.status, 'scheduled')
    provider.calls.cancel.length = 0

    const trialReset = await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })
    assert.equal(trialReset.body.record, null)
    assert.deepEqual(trialReset.body.history[0].objects, [{
      attemptId: expectAttemptId(trialReset.body.history[0]), associationId: future, action: 'setup_autopay',
      outcome: 'cancelled_by_reset', providerStatus: 'cancelled', cancellationRequestedAt: '2026-09-23T10:00:00.000Z',
    }])
    const paidReset = await reset(url, 'paid_V', { scenario: 'paid_sample', generation: 1 })
    assert.equal(paidReset.status, 200)
    assert.equal(paidReset.body.record, null)
    assert.deepEqual(paidReset.body.history[0].objects.map(({ outcome, providerStatus }) => [outcome, providerStatus]), [['cancelled_by_reset', 'cancelled']])
    // Every stop is immediate, and each was durable before Razorpay was asked.
    assert.deepEqual(provider.calls.cancel.map(({ id, cancelAtCycleEnd }) => [id, cancelAtCycleEnd]), [[future, false], [paid, false]])
    assert.equal(provider.calls.cancel[1].storedBefore.objects[0].outcome, 'cancel_requested')
    assert.equal(provider.calls.cancel[1].storedBefore.objects[0].associationId, paid)

    const history = paidReset.body.history[0]
    assert.equal(history.paidThrough, anchor)
    assert.equal(history.attempts[0].state, 'fee_confirmed')
    assert.deepEqual(history.attempts[0].fee, { amountMinor: 29900, currency: 'INR', periodStart: anchor, periodEnd: second })
    assert.equal(history.attempts[0].cancellation.state, 'scheduled')
    assert.equal(history.attempts[0].associationId, paid)
    // No idempotency keys, invoice or payment identifiers, signatures or callback fields are kept or shown.
    const stored = readFileSync(store, 'utf8')
    for (const text of [JSON.stringify(paidReset.body), JSON.stringify(await statusBody(url, 'paid_V'))]) {
      assert.doesNotMatch(text, /pay_fake|inv_fake|prepare_key|cancel_key|reset_key|signature|idempotencyKey/)
    }
    assert.doesNotMatch(stored, /pay_fake|inv_fake|signature/)
  })
})

function expectAttemptId(entry) {
  assert.match(entry.attempts[0].attemptId, /^lt_[a-f0-9]{32}$/)
  return entry.attempts[0].attemptId
}

test('keeps reset pending across mixed terminal and unconfirmed objects and blocks any new generation or Checkout', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    // A cancelled first agreement, closed at Razorpay, then a rejoined replacement.
    const first = await subscriptionOf(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate(first)
    await status(url, 'trial_V')
    await cancel(url, 'trial_V', 'cancel_key_1')
    await status(url, 'trial_V')
    const second = await subscriptionOf(url, 'trial_V', 'setup_autopay', 'prepare_key_2')
    provider.authenticate(second)
    await status(url, 'trial_V')
    const cancelsBefore = provider.calls.cancel.length

    // Razorpay accepts the stop, but no read shows it closed yet.
    provider.failCancel = 'accepted'
    const pending = await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })
    assert.equal(pending.status, 200)
    assert.equal(pending.body.record.reset.state, 'pending')
    assert.deepEqual(pending.body.record.reset.objects.map(({ associationId, outcome }) => [associationId, outcome]), [[first, 'closed'], [second, 'cancel_acknowledged']])
    assert.deepEqual(pending.body.record.availableActions, [])
    // The acknowledgement alone never completes reset: no new generation, Checkout or ordinary cancellation.
    assert.equal((await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'expired_trial' })).status, 409)
    assert.match((await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_3')).body.error, /reset is pending/)
    assert.match((await cancel(url, 'trial_V', 'cancel_key_2')).body.error, /reset is pending/)
    const read = await status(url, 'trial_V')
    assert.equal(read.reset.state, 'pending')
    assert.deepEqual(read.availableActions, [])
    assert.equal(provider.calls.create.length, 2)

    // A later provider read showing the object closed completes the same reset.
    provider.subscriptions.get(second).status = 'cancelled'
    const done = await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1, idempotencyKey: 'reset_key_2' })
    assert.equal(done.body.record, null)
    assert.equal(done.body.history.length, 1)
    assert.deepEqual(done.body.history[0].objects.map(({ associationId, outcome }) => [associationId, outcome]), [[first, 'closed'], [second, 'cancelled_by_reset']])
    assert.equal(done.body.history[0].resetRequestedAt, '2026-09-23T10:00:00.000Z')
    assert.equal(provider.calls.cancel.length, cancelsBefore + 1)
  })
})

test('a lost cancellation response keeps reset pending and a retry reconciles it by reading, surviving restart', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const sub = await subscriptionOf(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate(sub)
    // The stop lands at Razorpay, but its response is lost.
    provider.failCancel = 'timeout'
    const lost = await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })
    assert.equal(lost.body.record.reset.objects[0].outcome, 'cancel_requested')
    assert.equal(savedReset(store, 'trial_V').objects[0].outcome, 'cancel_requested')
  })
  currentTime = '2026-09-23T11:00:00Z'
  await withHelper({ file: store, provider }, async (url) => {
    // Restart keeps the same pending reset; a status read neither completes nor replaces it.
    const restored = await statusBody(url, 'trial_V')
    assert.equal(restored.record.reset.state, 'pending')
    assert.deepEqual(restored.history, [])
    // The retry reads the object closed and confirms it without asking Razorpay again.
    const done = await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1, idempotencyKey: 'reset_key_2' })
    assert.equal(done.body.record, null)
    assert.deepEqual(done.body.history[0].objects.map(({ outcome, cancellationRequestedAt }) => [outcome, cancellationRequestedAt]), [['cancelled_by_reset', '2026-09-23T10:00:00.000Z']])
    assert.equal(done.body.history[0].resetCompletedAt, '2026-09-23T11:00:00.000Z')
  })
  assert.equal(provider.calls.cancel.length, 1)
})

test('holds reset pending on read failures, rejections and uncertain creation, and never cancels an unowned object', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const sub = await subscriptionOf(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate(sub)
    provider.failReads = true
    const unreadable = await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })
    assert.deepEqual(unreadable.body.record.reset.objects.map(({ outcome }) => outcome), ['read_failed'])
    assert.equal(provider.calls.cancel.length, 0)
    provider.failReads = false
    provider.failCancel = 'rejected'
    const rejected = await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })
    assert.deepEqual(rejected.body.record.reset.objects.map(({ outcome }) => outcome), ['cancel_rejected'])
    assert.equal((await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })).body.record, null)
    assert.equal(provider.calls.cancel.length, 2)
  })

  // An object recorded for this scenario that Razorpay shows belongs to someone else is never cancelled.
  await withHelper({ file: store, provider }, async (url) => {
    provider.subscriptions.set('sub_foreign1', { id: 'sub_foreign1', plan_id: 'plan_monthly', status: 'active', quantity: 1, notes: {} })
    await request(url, 'POST', '/vendors/legacy_V/scenario', { scenario: 'active_trial' })
    await request(url, 'POST', '/vendors/legacy_V/intents', { action: 'setup_autopay', idempotencyKey: 'legacy_key_1' })
    await request(url, 'POST', '/vendors/legacy_V/associations', { idempotencyKey: 'legacy_key_1', subscriptionId: 'sub_foreign1' })
    const unowned = await reset(url, 'legacy_V', { scenario: 'active_trial', generation: 1 })
    assert.deepEqual(unowned.body.record.reset.objects.map(({ associationId, outcome }) => [associationId, outcome]), [['sub_foreign1', 'not_owned']])
    assert.equal(provider.subscriptions.get('sub_foreign1').status, 'active')
    assert.equal(provider.calls.cancel.length, 2)
  })

  // A creation whose response was lost is found by its tag and cancelled; one not yet visible stays uncertain.
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/lost_V/scenario', { scenario: 'expired_trial' })
    provider.failCreate = 'timeout'
    assert.equal((await prepare(url, 'lost_V', 'pay_first_fee', 'prepare_key_1')).status, 504)
    const found = await reset(url, 'lost_V', { scenario: 'expired_trial', generation: 1 })
    assert.equal(found.body.record, null)
    assert.equal(found.body.history[0].objects[0].outcome, 'cancelled_by_reset')
    assert.match(found.body.history[0].objects[0].associationId, /^sub_fake/)

    await request(url, 'POST', '/vendors/unseen_V/scenario', { scenario: 'expired_trial' })
    provider.failCreate = 'rejected'
    await prepare(url, 'unseen_V', 'pay_first_fee', 'prepare_key_2')
    // Stand in for a create whose outcome is unknown and which Razorpay does not list yet.
    const saved = JSON.parse(readFileSync(store, 'utf8'))
    saved.vendors.unseen_V.attempts[0].state = 'provider_requested'
    saved.vendors.unseen_V.attempts[0].requestedAt = currentTime
    writeFileSync(store, JSON.stringify(saved))
  })
  await withHelper({ file: store, provider }, async (url) => {
    const uncertain = await reset(url, 'unseen_V', { scenario: 'expired_trial', generation: 1 })
    assert.deepEqual(uncertain.body.record.reset.objects.map(({ associationId, outcome }) => [associationId, outcome]), [[null, 'creation_uncertain']])
    currentTime = '2026-09-23T10:11:00Z'
    const absent = await reset(url, 'unseen_V', { scenario: 'expired_trial', generation: 1 })
    assert.equal(absent.body.record, null)
    assert.equal(absent.body.history[0].objects[0].outcome, 'never_created')
  })
})

test('an old generation\'s late callback, read or replayed key never mutates the new generation', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const prepared = (await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')).body.attempt
    provider.authenticate(prepared.config.subscriptionId)
    await status(url, 'trial_V')
    // Plan's own cancellation already stopped it; reset reads it closed.
    await cancel(url, 'trial_V', 'cancel_key_1')
    await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })
    const fresh = (await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })).body.record
    assert.equal(fresh.generation, 2)

    // The old Checkout's callback arrives late.
    const late = await submit(url, 'trial_V', { attemptId: prepared.attemptId, subscriptionId: prepared.config.subscriptionId, paymentId: 'pay_late1', signature: sign('pay_late1', prepared.config.subscriptionId) })
    assert.equal(late.status, 409)
    // The old page replays its preparation and cancellation keys.
    assert.match((await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_1')).body.error, /earlier, reset Test scenario/)
    assert.match((await cancel(url, 'trial_V', 'cancel_key_1')).body.error, /earlier, reset Test scenario/)
    // A stale provider read of the old object shows it active again; the new generation never rereads it.
    provider.subscriptions.get(prepared.config.subscriptionId).status = 'active'
    const current = await statusBody(url, 'trial_V')
    assert.equal(current.record.generation, 2)
    assert.deepEqual(current.record.attempts, [])
    assert.equal(current.record.authorisationStatus, 'not_configured')
    assert.deepEqual(current.record.availableActions, ['setup_autopay'])
    assert.equal(current.history[0].objects[0].outcome, 'closed')
    // The new generation prepares its own object.
    const next = await prepare(url, 'trial_V', 'setup_autopay', 'prepare_key_9')
    assert.notEqual(next.body.attempt.config.subscriptionId, prepared.config.subscriptionId)
  })
})

test('the ledger intent and association routes also refuse a pending reset and a reset generation\'s keys', async () => {
  currentTime = '2026-09-23T10:00:00Z'
  const store = isolatedStore()
  const provider = fakeProvider()
  await withHelper({ file: store, provider }, async (url) => {
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    const sub = await subscriptionOf(url, 'trial_V', 'setup_autopay', 'prepare_key_1')
    provider.authenticate(sub)
    provider.failReads = true
    assert.equal((await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })).body.record.reset.state, 'pending')
    assert.match((await request(url, 'POST', '/vendors/trial_V/intents', { action: 'setup_autopay', idempotencyKey: 'ledger_key_1' })).body.error, /reset is pending/)
    assert.match((await request(url, 'POST', '/vendors/trial_V/associations', { idempotencyKey: 'prepare_key_1', subscriptionId: 'sub_other1' })).body.error, /reset is pending/)
    provider.failReads = false
    assert.equal((await reset(url, 'trial_V', { scenario: 'active_trial', generation: 1 })).body.record, null)
    await request(url, 'POST', '/vendors/trial_V/scenario', { scenario: 'active_trial' })
    assert.match((await request(url, 'POST', '/vendors/trial_V/intents', { action: 'setup_autopay', idempotencyKey: 'prepare_key_1' })).body.error, /earlier, reset Test scenario/)
    assert.deepEqual((await status(url, 'trial_V')).attempts, [])
  })
})
