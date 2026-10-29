import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'
import { createVendorBillingTestHelper, ProviderError } from './vendor-billing-test-helper.mjs'

const keyId = 'rzp_test_FakeKey0001'
const secret = 'fake-test-secret'
const planId = 'plan_FakeMonthly0001'
const day = 24 * 60 * 60 * 1000
const directory = mkdtempSync(join(tmpdir(), 'billing-helper-'))
after(() => rmSync(directory, { recursive: true, force: true }))

/** An in-memory Razorpay Test: subscriptions, invoices and payments, and a record of every write. */
function fakeRazorpay() {
  const subscriptions = new Map()
  const invoices = []
  const payments = new Map()
  const calls = []
  let next = 1
  const id = (prefix) => `${prefix}_Fake${String(next++).padStart(4, '0')}`
  return {
    calls, subscriptions,
    fetchPlan: async () => ({ id: planId, period: 'monthly', interval: 1, item: { amount: 39900, currency: 'INR' } }),
    createSubscription: async (body) => {
      calls.push(['create', body])
      const subscription = { id: id('sub'), status: 'created', plan_id: body.plan_id, start_at: body.start_at ?? null, notes: body.notes, short_url: 'https://rzp.io/fake' }
      subscriptions.set(subscription.id, subscription)
      return { ...subscription }
    },
    fetchSubscription: async (subscriptionId) => ({ ...subscriptions.get(subscriptionId) }),
    listInvoices: async ({ subscriptionId }) => ({ items: invoices.filter((item) => item.subscription_id === subscriptionId) }),
    fetchPayment: async (paymentId) => ({ ...payments.get(paymentId) }),
    cancelSubscription: async (subscriptionId) => {
      calls.push(['cancel', subscriptionId])
      subscriptions.get(subscriptionId).status = 'cancelled'
      return {}
    },
    /** Checkout paid the upfront addon: one invoice with no billing dates, its payment captured. */
    payAddon(subscriptionId, status = 'captured') {
      const payment = { id: id('pay'), amount: 39900, currency: 'INR', status }
      payments.set(payment.id, payment)
      invoices.push({ id: id('inv'), subscription_id: subscriptionId, status: 'paid', amount: 39900, payment_id: payment.id, billing_start: null, billing_end: null, line_items: [{ type: 'addon', amount: 39900 }] })
      subscriptions.get(subscriptionId).status = 'authenticated'
      return payment
    },
    /** A plan charge for one cycle: the immediate first fee or a renewal. */
    payCycle(subscriptionId, start, end) {
      const payment = { id: id('pay'), amount: 39900, currency: 'INR', status: 'captured' }
      payments.set(payment.id, payment)
      invoices.push({ id: id('inv'), subscription_id: subscriptionId, status: 'paid', amount: 39900, payment_id: payment.id, billing_start: Math.floor(start / 1000), billing_end: Math.floor(end / 1000), line_items: [{ type: 'plan' }] })
      subscriptions.get(subscriptionId).status = 'active'
    },
  }
}

let clock
let razorpay
let server
let base
let storeFile

async function start() {
  server = createVendorBillingTestHelper({ file: storeFile, keyId, secret, planId, provider: razorpay, now: () => new Date(clock) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
}

/** A new helper process on the same store. */
async function restart() {
  server.close()
  await start()
}

beforeEach(async () => {
  server?.close()
  clock = Date.parse('2026-10-07T10:00:00.000Z')
  razorpay = fakeRazorpay()
  storeFile = join(directory, `store-${Math.random()}.json`)
  await start()
})
after(() => server?.close())

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const envelope = await response.json()
  return { status: response.status, data: envelope.data, message: envelope.message, envelope }
}
const vendor = '/api/v1/vendors/r1/subscription'
const seed = (scenario) => call('POST', '/dev/vendors/r1/scenario', { scenario })
const read = async () => (await call('GET', vendor)).data
const subscribe = () => call('POST', vendor, { plan_code: 'MITHRA_SOCIAL_STARTER_MONTHLY' })
const history = async () => (await call('GET', `${vendor}/history`)).data
const signature = (paymentId, subscriptionId) => createHmac('sha256', secret).update(`${paymentId}|${subscriptionId}`).digest('hex')
const plusMonth = (iso) => { const at = new Date(iso); at.setUTCMonth(at.getUTCMonth() + 1); return at.toISOString() }

describe('backend shape', () => {
  it('lists the monthly plan in rupees and answers 404 before a scenario', async () => {
    const plans = await call('GET', '/api/v1/subscription-plans')
    assert.equal(plans.envelope.success, true)
    assert.deepEqual(plans.data.map(({ plan_code, billing_cycle, sale_price }) => ({ plan_code, billing_cycle, sale_price })), [{ plan_code: 'MITHRA_SOCIAL_STARTER_MONTHLY', billing_cycle: 'MONTHLY', sale_price: 399 }])
    const missing = await call('GET', vendor)
    assert.equal(missing.status, 404)
    assert.equal(missing.envelope.success, false)
  })

  it('refuses live or missing configuration', () => {
    assert.throws(() => createVendorBillingTestHelper({ file: join(directory, 'x.json'), keyId: 'rzp_live_X', secret, planId, provider: razorpay }))
    assert.throws(() => createVendorBillingTestHelper({ file: join(directory, 'x.json'), keyId, secret, planId: '', provider: razorpay }))
  })
})

describe('early first fee (flow 1)', () => {
  it('charges the plan price upfront with start_at = T + one month, and keeps the free days', async () => {
    await seed('free_days')
    const trial = await read()
    assert.equal(trial.status, 'TRIAL_ACTIVE')
    assert.equal(trial.plan_code, 'SOCIAL_STARTER_TRIAL')

    const subscribed = await subscribe()
    assert.equal(subscribed.status, 200)
    assert.equal(subscribed.data.razorpay_key_id, keyId)
    const [, body] = razorpay.calls.find(([kind]) => kind === 'create')
    assert.equal(body.start_at, Math.floor(Date.parse(plusMonth(trial.trial_ends_at)) / 1000))
    assert.deepEqual(body.addons, [{ item: { name: 'First month', amount: 39900, currency: 'INR' } }])

    // Subscribing alone changes nothing (gap C), and a repeat while unpaid returns the same subscription.
    const pending = await read()
    assert.equal(pending.status, 'TRIAL_ACTIVE')
    assert.equal(pending.razorpay_status, 'created')
    assert.equal((await subscribe()).data.razorpay_subscription_id, subscribed.data.razorpay_subscription_id)
    assert.equal(razorpay.calls.filter(([kind]) => kind === 'create').length, 1)

    const payment = razorpay.payAddon(subscribed.data.razorpay_subscription_id)
    const confirmed = await call('POST', `${vendor}/confirm`, { razorpay_payment_id: payment.id, razorpay_subscription_id: subscribed.data.razorpay_subscription_id, razorpay_signature: signature(payment.id, subscribed.data.razorpay_subscription_id) })
    assert.equal(confirmed.status, 200)
    assert.deepEqual(
      { status: confirmed.data.status, razorpay_status: confirmed.data.razorpay_status, start: confirmed.data.current_period_start, end: confirmed.data.current_period_end, next: confirmed.data.next_billing_at, trial: confirmed.data.trial_ends_at, flag: confirmed.data.cancel_at_period_end },
      { status: 'ACTIVE', razorpay_status: 'authenticated', start: trial.trial_ends_at, end: plusMonth(trial.trial_ends_at), next: plusMonth(trial.trial_ends_at), trial: trial.trial_ends_at, flag: false },
    )
    const charged = (await history()).filter((item) => item.event_type === 'SUBSCRIPTION_CHARGED')
    assert.equal(charged.length, 1)
    assert.equal(charged[0].amount, 399)
  })

  it('reads an authenticated but uncaptured fee as the trial, and refuses a second payment', async () => {
    await seed('free_days')
    const { data } = await subscribe()
    razorpay.payAddon(data.razorpay_subscription_id, 'authorized')
    const row = await read()
    assert.deepEqual([row.status, row.razorpay_status, row.current_period_end], ['TRIAL_ACTIVE', 'authenticated', null])
    assert.equal((await subscribe()).status, 409)
  })

  it('cancels a free-days subscription still created at T, then pays after T with an immediate start (gap I)', async () => {
    await seed('trial_ending_soon')
    const early = (await subscribe()).data.razorpay_subscription_id
    clock += 10 * 60 * 1000
    const expired = await read()
    assert.equal(expired.status, 'TRIAL_EXPIRED')
    assert.equal(razorpay.subscriptions.get(early).status, 'cancelled')

    const paying = await subscribe()
    assert.notEqual(paying.data.razorpay_subscription_id, early)
    const [, body] = razorpay.calls.filter(([kind]) => kind === 'create').at(-1)
    assert.equal(body.start_at, undefined)
    assert.equal(body.addons, undefined)
    assert.equal((await read()).status, 'PAYMENT_PENDING')

    const end = Date.parse('2026-11-07T18:30:00Z')
    razorpay.payCycle(paying.data.razorpay_subscription_id, clock, end)
    const paid = await read()
    assert.deepEqual([paid.status, paid.razorpay_status, paid.current_period_end, paid.next_billing_at], ['ACTIVE', 'active', new Date(end).toISOString(), new Date(end).toISOString()])
  })
})

describe('stop and keep shop open (flows 2 and 3)', () => {
  async function paidEarly() {
    await seed('free_days')
    const { data } = await subscribe()
    razorpay.payAddon(data.razorpay_subscription_id)
    return { id: data.razorpay_subscription_id, row: await read() }
  }

  it('stops with an immediate Razorpay cancel, keeping P, and a repeat writes nothing new', async () => {
    const { id, row } = await paidEarly()
    const stopped = await call('POST', `${vendor}/cancel`, {})
    assert.deepEqual(razorpay.calls.at(-1), ['cancel', id])
    assert.deepEqual(
      [stopped.data.status, stopped.data.cancel_at_period_end, stopped.data.current_period_end, stopped.data.next_billing_at, stopped.data.razorpay_status],
      ['ACTIVE', true, row.current_period_end, null, 'cancelled'],
    )
    await call('POST', `${vendor}/cancel`, {})
    assert.equal((await history()).filter((item) => item.event_type === 'CANCELLATION_REQUESTED').length, 1)
  })

  it('keeps the shop open with ₹ now for old P → old P + one month, after closing the old subscription', async () => {
    const { row } = await paidEarly()
    await call('POST', `${vendor}/cancel`, {})
    const kept = await subscribe()
    const [, body] = razorpay.calls.filter(([kind]) => kind === 'create').at(-1)
    assert.equal(body.start_at, Math.floor(Date.parse(plusMonth(row.current_period_end)) / 1000))
    assert.equal(body.addons[0].item.amount, 39900)
    // The stopped read stays until the ₹ is captured.
    assert.deepEqual([(await read()).cancel_at_period_end, (await read()).razorpay_status], [true, 'cancelled'])
    razorpay.payAddon(kept.data.razorpay_subscription_id)
    const open = await read()
    assert.deepEqual([open.status, open.cancel_at_period_end, open.current_period_start, open.current_period_end], ['ACTIVE', false, row.current_period_end, plusMonth(row.current_period_end)])
  })

  it('refuses a second subscription while a renewing plan is paid', async () => {
    await paidEarly()
    assert.equal((await subscribe()).status, 409)
  })

  it('stops a seeded paid plan locally, then keeps it open with a real subscription', async () => {
    await seed('paid')
    const stopped = (await call('POST', `${vendor}/cancel`, {})).data
    assert.deepEqual([stopped.status, stopped.cancel_at_period_end, stopped.razorpay_status], ['ACTIVE', true, 'cancelled'])
    await subscribe()
    assert.equal(razorpay.calls.filter(([kind]) => kind === 'create').at(-1)[1].start_at, Math.floor(Date.parse(plusMonth(stopped.current_period_end)) / 1000))
  })
})

describe('renewals and failures (flow 5)', () => {
  async function paidNow() {
    await seed('trial_ended')
    const { data } = await subscribe()
    const end = clock + 30 * day
    razorpay.payCycle(data.razorpay_subscription_id, clock, end)
    await read()
    return { id: data.razorpay_subscription_id, end }
  }

  it('extends P only along the original cycle', async () => {
    const { id, end } = await paidNow()
    clock = end + 60_000
    assert.equal((await read()).status, 'ACTIVE')
    razorpay.payCycle(id, end, end + 31 * day)
    const renewed = await read()
    assert.deepEqual([renewed.current_period_start, renewed.current_period_end], [new Date(end).toISOString(), new Date(end + 31 * day).toISOString()])
  })

  it('reads a retrying renewal as PAST_DUE and a halt as HALTED, cancelling the halted subscription', async () => {
    const { id, end } = await paidNow()
    clock = end + day
    razorpay.subscriptions.get(id).status = 'pending'
    assert.equal((await read()).status, 'PAST_DUE')
    razorpay.subscriptions.get(id).status = 'halted'
    assert.equal((await read()).status, 'HALTED')
    assert.equal(razorpay.subscriptions.get(id).status, 'cancelled')
    const recovery = await subscribe()
    assert.notEqual(recovery.data.razorpay_subscription_id, id)
    assert.equal((await read()).status, 'PAYMENT_PENDING')
  })

  it('reads AutoPay cancelled outside as CANCELLED with P kept (flow 6)', async () => {
    const { id, end } = await paidNow()
    razorpay.subscriptions.get(id).status = 'cancelled'
    const row = await read()
    assert.deepEqual([row.status, row.current_period_end], ['CANCELLED', new Date(end).toISOString()])
    assert.ok((await history()).some((item) => item.event_type === 'SUBSCRIPTION_CANCELLED'))
  })
})

describe('confirm and scenarios', () => {
  it('verifies the Checkout signature and records each payment once', async () => {
    await seed('free_days')
    const { data } = await subscribe()
    const subscriptionId = data.razorpay_subscription_id
    const forged = await call('POST', `${vendor}/confirm`, { razorpay_payment_id: 'pay_Fake9999', razorpay_subscription_id: subscriptionId, razorpay_signature: 'a'.repeat(64) })
    assert.equal(forged.status, 401)
    const body = { razorpay_payment_id: 'pay_Fake9999', razorpay_subscription_id: subscriptionId, razorpay_signature: signature('pay_Fake9999', subscriptionId) }
    assert.equal((await call('POST', `${vendor}/confirm`, body)).status, 200)
    assert.equal((await call('POST', `${vendor}/confirm`, body)).status, 200)
    assert.equal((await history()).filter((item) => item.event_type === 'PAYMENT_AUTHORIZED').length, 1)
    assert.equal((await call('POST', `${vendor}/confirm`, { ...body, razorpay_subscription_id: 'sub_Other' })).status, 400)
  })

  it('closes every open subscription before seeding another scenario', async () => {
    await seed('free_days')
    const { data } = await subscribe()
    const switched = await seed('payment_failed')
    assert.equal(switched.status, 200)
    assert.equal(razorpay.subscriptions.get(data.razorpay_subscription_id).status, 'cancelled')
    assert.equal((await read()).status, 'HALTED')
  })

  it('seeds every scenario in a shape the Live Plan reads', async () => {
    const expected = {
      free_days: 'TRIAL_ACTIVE', three_days_left: 'TRIAL_ACTIVE', trial_ending_soon: 'TRIAL_ACTIVE', trial_ended: 'TRIAL_EXPIRED', paid: 'ACTIVE', stopped: 'ACTIVE',
      autopay_off: 'CANCELLED', paid_days_ended: 'ACTIVE', renewal_retrying: 'PAST_DUE', payment_failed: 'HALTED',
    }
    for (const [scenario, status] of Object.entries(expected)) {
      await seed(scenario)
      const row = await read()
      assert.equal(row.status, status, scenario)
      assert.equal(typeof row.cancel_at_period_end, 'boolean')
      assert.match(row.trial_ends_at, /Z$/)
      assert.deepEqual([row.latest_payment_id, row.latest_payment_status], [null, null], scenario)
    }
  })

  it('refuses a foreign origin and answers a Razorpay outage with 504', async () => {
    const foreign = await fetch(`${base}/dev/vendors/r1/scenario`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.com' }, body: '{"scenario":"paid"}' })
    assert.equal(foreign.status, 403)
    await seed('free_days')
    razorpay.createSubscription = async () => { throw new ProviderError('Razorpay Test did not respond.', false) }
    assert.equal((await subscribe()).status, 504)
  })
})

describe('simulated payment outcomes', () => {
  const delay = 5000
  const simulate = (outcome, vendorId = 'r1') => call('POST', `/dev/vendors/${vendorId}/simulation`, { outcome })
  const pay = (subscriptionId, vendorId = 'r1') => call('POST', `/dev/vendors/${vendorId}/simulation/pay`, { subscription_id: subscriptionId })
  const deliver = (result) => call('POST', '/dev/vendors/r1/simulation/deliver', { result })
  const confirm = (callback) => call('POST', `${vendor}/confirm`, callback)
  /** Razorpay writes: a simulated subscription must never cause one. */
  const providerWrites = () => razorpay.calls.filter(([kind]) => kind === 'create' || kind === 'cancel')
  const facts = (row) => [row.status, row.razorpay_status, row.current_period_start, row.current_period_end]
  /** Chooses `outcome`, subscribes, and pays through the stand-in Checkout, confirming like the Plan's handler. */
  async function payWith(outcome) {
    await simulate(outcome)
    const { data } = await subscribe()
    const paid = await pay(data.razorpay_subscription_id)
    assert.equal(paid.status, 200)
    assert.equal((await confirm(paid.data)).status, 200)
    return { id: data.razorpay_subscription_id, paymentId: paid.data.razorpay_payment_id }
  }

  it('early + succeed: confirming until the delay, then paid T → T + one month, without Razorpay writes', async () => {
    assert.deepEqual((await call('GET', '/dev/vendors/r1/simulation')).data, { outcome: 'real', delay_ms: delay })
    await seed('free_days')
    const trial = await read()
    assert.deepEqual((await simulate('succeed')).data, { outcome: 'succeed', delay_ms: delay })
    const { data } = await subscribe()
    assert.match(data.razorpay_subscription_id, /^sub_Sim/)
    const paid = await pay(data.razorpay_subscription_id)
    assert.match(paid.data.razorpay_payment_id, /^pay_Sim/)
    assert.equal(paid.data.razorpay_subscription_id, data.razorpay_subscription_id)
    assert.equal(paid.data.razorpay_signature, signature(paid.data.razorpay_payment_id, data.razorpay_subscription_id))
    const confirmed = await confirm(paid.data)
    assert.equal(confirmed.status, 200)
    assert.deepEqual(facts(confirmed.data), ['TRIAL_ACTIVE', 'authenticated', null, null])
    clock += delay - 1
    assert.deepEqual(facts(await read()), ['TRIAL_ACTIVE', 'authenticated', null, null])
    clock += 1
    assert.deepEqual(facts(await read()), ['ACTIVE', 'authenticated', trial.trial_ends_at, plusMonth(trial.trial_ends_at)])
    const charged = (await history()).filter((item) => item.event_type === 'SUBSCRIPTION_CHARGED')
    assert.deepEqual(charged.map((item) => item.amount), [399])
    assert.deepEqual(providerWrites(), [])
  })

  it('early + fail: plain free days after the delay, then the same subscription is paid again', async () => {
    await seed('free_days')
    const trial = await read()
    const { id, paymentId } = await payWith('fail')
    clock += delay
    assert.deepEqual(facts(await read()), ['TRIAL_ACTIVE', 'created', null, null])
    assert.deepEqual((await history()).filter((item) => item.event_type === 'PAYMENT_FAILED').map((item) => item.external_payment_id), [paymentId])
    const again = await subscribe()
    assert.equal(again.status, 200)
    assert.equal(again.data.razorpay_subscription_id, id)
    await simulate('succeed')
    const retry = await pay(id)
    assert.notEqual(retry.data.razorpay_payment_id, paymentId)
    await confirm(retry.data)
    clock += delay
    assert.deepEqual(facts(await read()), ['ACTIVE', 'authenticated', trial.trial_ends_at, plusMonth(trial.trial_ends_at)])
    assert.deepEqual(providerWrites(), [])
  })

  it('free days over + pending: PAYMENT_PENDING until delivered, then paid from the payment time', async () => {
    await seed('trial_ended')
    const paidAt = new Date(clock).toISOString()
    await payWith('pending')
    assert.deepEqual(facts(await read()), ['PAYMENT_PENDING', 'created', null, null])
    clock += day
    assert.deepEqual(facts(await read()), ['PAYMENT_PENDING', 'created', null, null])
    assert.equal((await subscribe()).status, 409)
    assert.equal((await deliver('succeed')).status, 200)
    assert.deepEqual(facts(await read()), ['ACTIVE', 'active', paidAt, plusMonth(paidAt)])
    assert.equal((await deliver('succeed')).status, 409)
    assert.deepEqual(providerWrites(), [])
  })

  it('immediate + fail: PAYMENT_PENDING after free days, HALTED after a halt; a later success pays', async () => {
    await seed('trial_ended')
    await payWith('fail')
    clock += delay
    assert.deepEqual(facts(await read()), ['PAYMENT_PENDING', 'created', null, null])

    await seed('payment_failed')
    const halted = await read()
    const { id } = await payWith('fail')
    clock += delay
    assert.deepEqual(facts(await read()), ['HALTED', 'created', halted.current_period_start, halted.current_period_end])
    await simulate('succeed')
    assert.equal((await subscribe()).data.razorpay_subscription_id, id)
    await confirm((await pay(id)).data)
    clock += delay
    assert.equal((await read()).status, 'ACTIVE')

    await seed('payment_failed')
    await payWith('succeed')
    clock += delay
    assert.deepEqual((await read()).status, 'ACTIVE')
    assert.deepEqual(providerWrites(), [])
  })

  it('keep shop open: the stopped read stays while pending and after a failure; success extends P by one month', async () => {
    await seed('stopped')
    const stopped = await read()
    const stoppedFacts = (row) => [row.status, row.cancel_at_period_end, row.razorpay_status, row.current_period_end]
    await payWith('pending')
    assert.deepEqual(stoppedFacts(await read()), stoppedFacts(stopped))
    await deliver('succeed')
    const open = await read()
    assert.deepEqual([open.status, open.cancel_at_period_end, open.current_period_start, open.current_period_end], ['ACTIVE', false, stopped.current_period_end, plusMonth(stopped.current_period_end)])

    await seed('stopped')
    const again = await read()
    const { id } = await payWith('fail')
    clock += delay
    assert.deepEqual(stoppedFacts(await read()), stoppedFacts(again))
    assert.equal((await subscribe()).data.razorpay_subscription_id, id)
    assert.deepEqual(providerWrites(), [])
  })

  it('a pending early fee across T is not cancelled as a created free-days subscription', async () => {
    await seed('trial_ending_soon')
    const trial = await read()
    await payWith('pending')
    clock += 10 * 60 * 1000
    assert.deepEqual(facts(await read()), ['TRIAL_EXPIRED', 'authenticated', null, null])
    await deliver('succeed')
    assert.deepEqual(facts(await read()), ['ACTIVE', 'authenticated', trial.trial_ends_at, plusMonth(trial.trial_ends_at)])
    assert.deepEqual(providerWrites(), [])
  })

  it('pays only the vendor\'s own open simulated subscription, once at a time', async () => {
    await seed('free_days')
    const real = (await subscribe()).data.razorpay_subscription_id
    assert.equal((await pay(real)).status, 400)
    await simulate('pending')
    assert.equal((await pay(real)).status, 400)

    await call('POST', '/dev/vendors/r2/scenario', { scenario: 'free_days' })
    await simulate('pending', 'r2')
    const foreign = (await call('POST', '/api/v1/vendors/r2/subscription', { plan_code: 'MITHRA_SOCIAL_STARTER_MONTHLY' })).data.razorpay_subscription_id
    assert.equal((await pay(foreign)).status, 400)

    // Switching to a simulated outcome never reuses the real `created` subscription.
    const { data } = await subscribe()
    assert.notEqual(data.razorpay_subscription_id, real)
    assert.match(data.razorpay_subscription_id, /^sub_Sim/)
    assert.deepEqual(razorpay.calls.at(-1), ['cancel', real])
    assert.equal((await pay(data.razorpay_subscription_id)).status, 200)
    assert.equal((await pay(data.razorpay_subscription_id)).status, 409)
    assert.equal((await subscribe()).status, 409)
  })

  it('refuses a simulated payment once Real Test Checkout is chosen again', async () => {
    await seed('free_days')
    await simulate('fail')
    const { data } = await subscribe()
    await simulate('real')
    assert.equal((await pay(data.razorpay_subscription_id)).status, 409)
  })

  it('closes a simulated subscription on a seed or a switch back to real without Razorpay', async () => {
    await seed('free_days')
    await simulate('succeed')
    const simulated = (await subscribe()).data.razorpay_subscription_id
    await simulate('real')
    const real = (await subscribe()).data.razorpay_subscription_id
    assert.notEqual(real, simulated)
    assert.deepEqual(providerWrites().map(([kind]) => kind), ['create'])

    await simulate('pending')
    await seed('free_days')
    assert.deepEqual(razorpay.calls.filter(([kind]) => kind === 'cancel'), [['cancel', real]])
    await payWith('pending')
    await seed('free_days')
    assert.equal((await deliver('succeed')).status, 409)
    assert.deepEqual(razorpay.calls.filter(([kind]) => kind === 'cancel'), [['cancel', real]])
  })

  it('never settles a payment on a subscription cancelled while it was pending', async () => {
    await seed('trial_ended')
    await payWith('succeed')
    assert.equal((await call('POST', `${vendor}/cancel`, {})).status, 200)
    clock += 2 * delay
    assert.deepEqual(facts(await read()), ['TRIAL_EXPIRED', 'cancelled', null, null])
    assert.equal((await deliver('succeed')).status, 409)
    assert.equal((await history()).some((item) => item.event_type === 'SUBSCRIPTION_CHARGED'), false)
    assert.deepEqual(providerWrites(), [])
  })

  describe('latest payment on the read', () => {
    const latest = (row) => [row.latest_payment_id, row.latest_payment_status]

    it('reports the simulated payment authorized while pending, then captured after the delay', async () => {
      await seed('free_days')
      await simulate('succeed')
      const { data } = await subscribe()
      assert.deepEqual(latest(data), [null, null])
      const paid = await pay(data.razorpay_subscription_id)
      const paymentId = paid.data.razorpay_payment_id
      assert.deepEqual(latest(await read()), [paymentId, 'authorized'])
      assert.deepEqual(latest((await confirm(paid.data)).data), [paymentId, 'authorized'])
      clock += delay
      assert.deepEqual(latest(await read()), [paymentId, 'captured'])
    })

    it('reports a failure after the delay or on delivery, and a retry on the same subscription as the new payment', async () => {
      await seed('free_days')
      const { id, paymentId } = await payWith('fail')
      assert.deepEqual(latest(await read()), [paymentId, 'authorized'])
      clock += delay
      assert.deepEqual(latest(await read()), [paymentId, 'failed'])

      await simulate('pending')
      assert.equal((await subscribe()).data.razorpay_subscription_id, id)
      const retry = (await pay(id)).data.razorpay_payment_id
      assert.notEqual(retry, paymentId)
      assert.deepEqual(latest(await read()), [retry, 'authorized'])
      assert.deepEqual(latest((await deliver('fail')).data), [retry, 'failed'])
      assert.deepEqual(latest(await read()), [retry, 'failed'])
    })

    it('reports the payment on the subscription being paid, not the one the read reports', async () => {
      await seed('stopped')
      const stopped = await read()
      const { paymentId } = await payWith('fail')
      clock += delay
      const row = await read()
      assert.deepEqual([row.razorpay_subscription_id, row.razorpay_status], [stopped.razorpay_subscription_id, stopped.razorpay_status])
      assert.deepEqual(latest(row), [paymentId, 'failed'])

      await seed('trial_ended')
      const immediate = await payWith('fail')
      assert.deepEqual(latest(await read()), [immediate.paymentId, 'authorized'])
      clock += delay
      const failed = await read()
      assert.deepEqual([failed.status, failed.razorpay_status, ...latest(failed)], ['PAYMENT_PENDING', 'created', immediate.paymentId, 'failed'])
    })

    it('reports nothing for a real Razorpay Test subscription, paid or not', async () => {
      await seed('free_days')
      const { data } = await subscribe()
      razorpay.payAddon(data.razorpay_subscription_id, 'authorized')
      assert.deepEqual(latest(await read()), [null, null])

      await seed('trial_ended')
      const paying = (await subscribe()).data.razorpay_subscription_id
      razorpay.payCycle(paying, clock, clock + 30 * day)
      const paid = await read()
      assert.equal(paid.status, 'ACTIVE')
      assert.deepEqual(latest(paid), [null, null])
    })
  })

  it('refuses unknown outcomes and results', async () => {
    assert.equal((await simulate('fail')).status, 404)
    await seed('free_days')
    assert.equal((await simulate('maybe')).status, 400)
    assert.equal((await deliver('maybe')).status, 400)
  })

  it('keeps the chosen outcome across a seed and a restart, and settles a pending payment on time after one', async () => {
    await seed('free_days')
    await simulate('fail')
    await seed('paid')
    assert.equal((await call('GET', '/dev/vendors/r1/simulation')).data.outcome, 'fail')

    await seed('free_days')
    await payWith('succeed')
    clock += delay / 2
    await restart()
    assert.deepEqual((await call('GET', '/dev/vendors/r1/simulation')).data, { outcome: 'succeed', delay_ms: delay })
    assert.equal((await read()).status, 'TRIAL_ACTIVE')
    clock += delay / 2
    assert.equal((await read()).status, 'ACTIVE')
  })
})
