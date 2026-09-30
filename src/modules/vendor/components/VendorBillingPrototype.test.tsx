// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { prototypeSeed, prototypeStateLabels, type PrototypeState } from '@/shared/api'
import * as checkout from '@/shared/payments/razorpay-checkout'
import { CheckoutBeforeOpenError, type SubscriptionCheckoutResult } from '@/shared/payments/razorpay-checkout'
import { resetBillingPrototypeState } from '@/modules/vendor/hooks/use-billing-prototype'
import { PrototypeShellBanner } from './BillingPrototypeChrome'
import { VendorBillingPrototype } from './VendorBillingPrototype'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); resetBillingPrototypeState() })

/** As in the console: the shell's banner, linking to Plan, reads the state Plan shows. */
const renderInRouter = (ui: ReactElement) => render(<MemoryRouter><PrototypeShellBanner />{ui}</MemoryRouter>)

const serverTime = '2026-09-24T10:00:00.000Z'

/** Stands in for the local helper's scenario routes, reset included. */
function fakeHelper(initial: PrototypeState | null, { pendingResets = 0, readAt = serverTime, setup = 'confirmed' as 'confirmed' | 'pending', turnOff = 'confirmed' as 'confirmed' | 'acknowledged', payment = 'confirmed' as 'confirmed' | 'pending', failStops = 0, stop = 'accepted' as 'accepted' | 'unconfirmed', loseSubmission = false, retrying = false } = {}) {
  let generation = initial ? 1 : 0
  let record: Record<string, unknown> | null = initial ? recordFor(initial, generation) : null
  let pending = pendingResets
  let stopFailures = failStops
  const requests: Array<{ method: string; path: string; body?: Record<string, unknown> }> = []
  let prepared: unknown = null
  function recordFor(scenario: PrototypeState, value: number) {
    const trial = scenario === 'free_days' || scenario === 'three_days_left'
    const payNow = scenario === 'payment_failed' || scenario === 'shop_closed'
    return { vendorId: 'r1-prototype', scenario, generation: value, serverTime: readAt, ...prototypeSeed(scenario, new Date(serverTime)),
      attempts: [], associations: [], availableActions: trial || scenario === 'stopped' ? ['setup_autopay'] : payNow ? ['pay_first_fee'] : scenario === 'paid' ? ['setup_autopay', 'cancel'] : [],
      authorisationStatus: 'not_configured', nextChargeAt: null, cancellation: null, paymentStatus: retrying ? 'pending' : 'none', collectionRetrying: retrying,
      providerVerified: { authorisation: false, payment: false, coverage: false }, providerCheck: 'not_checked' }
  }
  /** What the helper returns once it has verified the callback and read Razorpay Test. */
  function afterSetup(current: Record<string, unknown>) {
    if (setup === 'pending') return { ...current, authorisationStatus: 'pending', availableActions: [] }
    return { ...current, authorisationStatus: 'confirmed', nextChargeAt: current.trialEndsAt, availableActions: ['cancel'],
      events: [...current.events as object[], { kind: 'autopay_on', at: serverTime, chargeAt: current.trialEndsAt }] }
  }
  /** A ₹299 paid now: the helper moves the scenario to Paid over Razorpay's invoice period, ending at IST midnight. */
  function afterPayment(current: Record<string, unknown>) {
    if (payment === 'pending') return { ...current, paymentStatus: 'pending', authorisationStatus: 'confirmed', availableActions: [] }
    const paidThrough = '2026-10-23T18:30:00.000Z'
    return { ...current, scenario: 'paid', paidThrough, nextChargeAt: paidThrough, autoPay: 'on', failedPaymentAt: null, paymentStatus: 'confirmed', authorisationStatus: 'confirmed',
      accessStatus: 'PAID', availableActions: ['cancel'], providerVerified: { authorisation: true, payment: true, coverage: true },
      events: [...current.events as object[], { kind: 'paid', at: serverTime, amountMinor: 29900, paidThrough }] }
  }
  /** Stop the plan: the sample stops locally; a paid Test subscription is stopped at cycle end, which Razorpay Test accepted. */
  function afterStop(current: Record<string, unknown>) {
    // An immediate stop Razorpay Test accepted but no read has shown closed leaves Paid, with AutoPay turning off.
    if (stop === 'unconfirmed') return { ...current, cancellation: { status: 'requested', stage: 'acknowledged', mode: 'immediate', requestedAt: serverTime, effectiveAt: null }, availableActions: [] }
    const real = (current.providerVerified as { coverage: boolean }).coverage
    return { ...current, scenario: 'stopped', autoPay: 'cancelled', nextChargeAt: null, availableActions: ['setup_autopay'],
      cancellation: real ? { status: 'scheduled', stage: 'scheduled', mode: 'cycle_end', requestedAt: serverTime, effectiveAt: current.paidThrough } : null,
      events: [...current.events as object[], { kind: 'plan_stopped', at: serverTime, paidThrough: current.paidThrough }] }
  }
  /** Keep shop open: Razorpay Test shows the future-start AutoPay authorised, so Stopped returns to Paid with the same paid-through. */
  function afterKeepOpen(current: Record<string, unknown>) {
    if (setup === 'pending') return { ...current, authorisationStatus: 'pending', availableActions: [], cancellation: null }
    return { ...current, scenario: 'paid', autoPay: 'on', authorisationStatus: 'confirmed', nextChargeAt: current.paidThrough, availableActions: ['cancel'], cancellation: null,
      events: [...current.events as object[], { kind: 'plan_resumed', at: serverTime, chargeAt: current.paidThrough }] }
  }
  function afterTurnOff(current: Record<string, unknown>) {
    const cancellation = { status: turnOff === 'confirmed' ? 'confirmed' : 'requested', stage: turnOff, mode: 'immediate', requestedAt: serverTime, effectiveAt: turnOff === 'confirmed' ? serverTime : null }
    if (turnOff === 'acknowledged') return { ...current, cancellation, availableActions: [] }
    return { ...current, cancellation, authorisationStatus: 'revoked', nextChargeAt: null, availableActions: ['setup_autopay'],
      events: [...current.events as object[], { kind: 'autopay_off', at: serverTime }] }
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET'
    const path = url.replace('/__local_vendor_billing_test', '')
    const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : undefined
    requests.push({ method, path, body })
    if (path.endsWith('/scenario')) { generation += 1; record = recordFor(body?.scenario as PrototypeState, generation) }
    if (path.endsWith('/preparations') && record) {
      prepared = body?.action
      return { ok: true, json: async () => ({ record, attempt: {
        attemptId: 'lt_proto1', vendorId: 'r1-prototype', action: body?.action, mode: 'provider',
        expected: { amountMinor: 29900, currency: 'INR', chargeAt: body?.action === 'pay_first_fee' ? null : record!.trialEndsAt, authorisationAmountMinor: null },
        config: { keyId: 'rzp_test_placeholder', subscriptionId: 'sub_proto1', name: 'MithraDirect' }, expiresAt: '2026-09-24T10:30:00.000Z',
      } }) }
    }
    if (path.endsWith('/submissions') && record) {
      record = prepared === 'pay_first_fee' ? afterPayment(record) : record.scenario === 'stopped' ? afterKeepOpen(record) : afterSetup(record)
      // The callback never reaches the helper, whose next read of Razorpay Test still finds the outcome.
      if (loseSubmission) throw new TypeError('connection reset')
    }
    if (path.endsWith('/cancellations') && record) {
      if (record.scenario !== 'paid') record = afterTurnOff(record)
      else if (stopFailures > 0) { stopFailures -= 1; return { ok: false, json: async () => ({ error: 'The Razorpay Test cancellation outcome is uncertain, so future collection is not shown as stopped. Refresh billing status to reconcile it.' }) } }
      else record = afterStop(record)
    }
    if (path.endsWith('/resets') && record) {
      if (pending > 0) { pending -= 1; record = { ...record, reset: { state: 'pending', requestedAt: serverTime, objects: [{ associationId: 'sub_x', action: 'setup_autopay', outcome: 'cancel_acknowledged', providerStatus: 'active' }] } } }
      else record = null
    }
    return { ok: true, json: async () => ({ record, history: [] }) }
  }))
  /** Razorpay Test captures a pending ₹299, so the next status read shows it. */
  const capture = () => { payment = 'confirmed'; if (record) record = afterPayment(record) }
  return Object.assign(requests, { capture })
}

const chip = (name: string) => screen.getByRole('button', { name })

describe('VendorBillingPrototype', () => {
  it('shows the stored state from the helper with its chip selected', async () => {
    const requests = fakeHelper('paid')
    renderInRouter(<VendorBillingPrototype />)
    expect(await screen.findByText('Shop is open')).toBeTruthy()
    expect(screen.getByText('You paid ₹299 via Razorpay. Shop stays open until 24 Oct. Next month is another ₹299.')).toBeTruthy()
    expect(screen.getByText('Mithra Social Starter · ₹299 / month')).toBeTruthy()
    expect(chip('Paid').getAttribute('aria-pressed')).toBe('true')
    expect(chip('Free days').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Prototype: try each shop-plan state')).toBeTruthy()
    expect(requests.every((request) => request.path.startsWith('/vendors/r1-prototype/'))).toBe(true)
  })

  it('shows only that the shop is open while Razorpay retries past the boundary, with no dates or banner', async () => {
    fakeHelper('paid', { retrying: true })
    renderInRouter(<VendorBillingPrototype />)
    expect(await screen.findByText('Shop is open')).toBeTruthy()
    expect(screen.getByText('AutoPay on.')).toBeTruthy()
    expect(screen.queryByText(/Shop stays open until/)).toBeNull()
    expect(screen.queryByRole('status', { name: 'Shop plan status' })).toBeNull()
  })

  it('keeps actions and chips off while Plan rereads the helper on a revisit, so no request races that read', async () => {
    fakeHelper('payment_failed')
    const pay = () => screen.getByRole('button', { name: 'Pay ₹299 with Razorpay' })
    const first = renderInRouter(<VendorBillingPrototype />)
    await waitFor(() => expect(pay().hasAttribute('disabled')).toBe(false))
    first.unmount()
    const helperFetch = globalThis.fetch
    let release!: () => void
    const held = new Promise<void>((resolve) => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(async (...args: Parameters<typeof fetch>) => { await held; return helperFetch(...args) }))
    renderInRouter(<VendorBillingPrototype />)
    expect(pay().hasAttribute('disabled')).toBe(true)
    expect(chip('Paid').hasAttribute('disabled')).toBe(true)
    release()
    await waitFor(() => expect(pay().hasAttribute('disabled')).toBe(false))
    expect(chip('Paid').hasAttribute('disabled')).toBe(false)
  })

  it('selects Free days through the helper when no prototype state is stored', async () => {
    const requests = fakeHelper(null)
    renderInRouter(<VendorBillingPrototype />)
    expect(await screen.findByText('12')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }).hasAttribute('disabled')).toBe(false)
    expect(chip('Free days').getAttribute('aria-pressed')).toBe('true')
    expect(requests.filter((request) => request.method === 'POST')).toEqual([{ method: 'POST', path: '/vendors/r1-prototype/scenario', body: { scenario: 'free_days' } }])
  })

  it('resets the current prototype scenario before selecting the chosen chip', async () => {
    const requests = fakeHelper('free_days')
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByText('12')
    fireEvent.click(chip('Stopped'))
    expect(await screen.findByText('8')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep shop open · ₹299' })).toBeTruthy()
    expect(screen.getByText('You stopped the plan. Shop stays open until 2 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')).toBeTruthy()
    expect(chip('Stopped').getAttribute('aria-pressed')).toBe('true')
    const writes = requests.filter((request) => request.method === 'POST')
    expect(writes.map((request) => request.path)).toEqual(['/vendors/r1-prototype/resets', '/vendors/r1-prototype/scenario'])
    expect(writes[0].body).toMatchObject({ scenario: 'free_days', generation: 1 })
    expect(writes[1].body).toEqual({ scenario: 'stopped' })
    expect(requests.some((request) => request.path.startsWith('/vendors/r1/'))).toBe(false)
  })

  it('keeps showing Switching… with a retry while the reset is unconfirmed, and retries with the same key', async () => {
    const requests = fakeHelper('free_days', { pendingResets: 1 })
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByText('12')
    fireEvent.click(chip('Payment failed'))
    expect(await screen.findByRole('button', { name: 'Retry switch' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Switching…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Retry switch' }))
    expect(await screen.findByText('Shop is hidden')).toBeTruthy()
    const resets = requests.filter((request) => request.path.endsWith('/resets'))
    expect(resets).toHaveLength(2)
    expect(resets[1].body?.idempotencyKey).toBe(resets[0].body?.idempotencyKey)
    expect(screen.queryByRole('button', { name: 'Retry switch' })).toBeNull()
    expect(chip('Payment failed').getAttribute('aria-pressed')).toBe('true')
  })

  it('renders the seed display-only when the helper is down, with actions disabled', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('connection refused') })
    vi.stubGlobal('fetch', fetch)
    renderInRouter(<VendorBillingPrototype />)
    expect(await screen.findByText(/Start it with npm run dev:billing-helper/)).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Set up AutoPay · ₹299 on / }).hasAttribute('disabled')).toBe(true)
    const calls = fetch.mock.calls.length
    fireEvent.click(chip('Shop closed'))
    expect(await screen.findByText('Paid days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay ₹299 with Razorpay' }).hasAttribute('disabled')).toBe(true)
    expect(chip('Shop closed').getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(fetch.mock.calls.length).toBe(calls))
  })

  const section = (name: string) => screen.queryByRole('region', { name })
  const banner = () => screen.queryByRole('status', { name: 'Shop plan status' })

  it.each([
    ['free_days', '12 free days left — after that, subscribe with Razorpay (₹299 / month) to keep the shop open.', 'Pay ₹299', ['Free days started14 free days · 2 days ago']],
    ['three_days_left', '3 free days left — set up AutoPay now so customers can still open your shop when free days end.', 'Pay ₹299', ['Free days started14 free days · 11 days ago']],
    ['payment_failed', 'Shop is hidden from customers — last Razorpay payment did not go through. Pay ₹299 to open the shop again.', 'Pay ₹299',
      ['Payment did not go throughShop hidden from customers · Today', 'AutoPay onFirst ₹299 on 21 Sept · 8 days ago', 'Free days started14 free days · 17 days ago']],
    ['stopped', 'Shop stays open until 2 Oct — then customers cannot see it. You can pay again any time with Razorpay.', 'Keep open · ₹299',
      ['Plan stoppedShop stays open until paid days end · Today', 'Paid ₹299Shop open until 2 Oct · 22 days ago']],
    ['shop_closed', 'Shop is hidden from customers — pay ₹299 with Razorpay to open it again.', 'Pay ₹299',
      ['Plan stoppedPaid days ended · 2 days ago', 'Paid ₹299One month · Last month']],
  ] as const)('lays out %s with its banner, both lists and its history, and no Stop the plan', async (state, copy, action, rows) => {
    fakeHelper(state)
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByRole('button', { name: prototypeStateLabels[state], pressed: true })
    expect(banner()?.textContent).toBe(`${copy}${action}`)
    expect(within(banner()!).getByRole('link', { name: action }).getAttribute('href')).toBe('/vendor/plan')
    expect(within(section('What you get')!).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      ['Your own shop link', 'Customers order on WhatsApp', 'Share on Instagram and Facebook', 'Add products and prices', 'See all orders in one place'])
    expect(within(section('If you do not pay')!).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      ['Customers cannot open your shop', 'New orders stop', 'You can still see old orders', 'You can pay again any time'])
    expect(within(section('Payments you made')!).getAllByRole('listitem').map((item) => item.textContent)).toEqual(rows)
    expect(section('Stop the plan')).toBeNull()
  })

  it('lays out Paid without a banner or If you do not pay, and with Stop the plan', async () => {
    fakeHelper('paid')
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByText('Shop is open')
    expect(banner()).toBeNull()
    expect(section('What you get')).toBeTruthy()
    expect(section('If you do not pay')).toBeNull()
    expect(within(section('Payments you made')!).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      ['Paid ₹299Shop open until 24 Oct · Today', 'Free days started14 free days · 14 days ago'])
    const stop = section('Stop the plan')!
    expect(stop.textContent).toContain('Stop any time. The shop stays open until the days you already paid for are over.')
    expect(within(stop).getByRole('button', { name: 'Stop the plan' })).toBeTruthy()
    const order = ['What you get', 'Payments you made', 'Stop the plan', 'Prototype: try each shop-plan state'].map((name) => screen.getByText(name, { selector: 'h2' }))
    for (const [index, heading] of order.slice(1).entries()) expect(order[index].compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('dates the history from the helper read time, not the browser clock', async () => {
    fakeHelper('three_days_left', { readAt: '2026-09-26T10:00:00.000Z' })
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByRole('button', { name: '3 days left', pressed: true })
    expect(within(section('Payments you made')!).getByRole('listitem').textContent).toBe('Free days started14 free days · 13 days ago')
    expect(banner()?.textContent).toMatch(/^1 free day left/)
  })

  it('keeps the full layout when the helper is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByText(/Start it with npm run dev:billing-helper/)
    expect(banner()?.textContent).toMatch(/^12 free days left/)
    expect(within(section('Payments you made')!).getByRole('listitem').textContent).toBe('Free days started14 free days · 2 days ago')
    fireEvent.click(chip('Paid'))
    expect(await screen.findByRole('region', { name: 'Stop the plan' })).toBeTruthy()
    expect(within(section('Stop the plan')!).getByRole('button', { name: 'Stop the plan' }).hasAttribute('disabled')).toBe(true)
    expect(banner()).toBeNull()
  })

  it('keeps the history section for a scenario stored before history was seeded', async () => {
    const { events: _events, ...seed } = prototypeSeed('stopped', new Date(serverTime))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ history: [], record: { vendorId: 'r1-prototype', scenario: 'stopped', generation: 3, serverTime, ...seed, attempts: [], associations: [] } }) })))
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByRole('button', { name: 'Stopped', pressed: true })
    expect(section('Payments you made')?.textContent).toBe('Payments you madeNothing recorded yet.')
  })
})

describe('VendorBillingPrototype pay ₹299 now', () => {
  /** Hosted Razorpay Checkout is stubbed at its export seam; no test reaches Razorpay. */
  const open = () => vi.spyOn(checkout, 'openSubscriptionCheckout')
  const submitted = (): SubscriptionCheckoutResult => ({ status: 'submitted', callback: { razorpay_payment_id: 'pay_proto2', razorpay_subscription_id: 'sub_proto1', razorpay_signature: 'b'.repeat(64) } })
  const posts = (requests: ReturnType<typeof fakeHelper>, operation: string) => requests.filter((request) => request.method === 'POST' && request.path === `/vendors/r1-prototype/${operation}`)
  const payButton = () => screen.findByRole('button', { name: 'Pay ₹299 with Razorpay' })

  it.each(['payment_failed', 'shop_closed'] as const)('moves %s to Paid over the provider period after one hosted Checkout', async (state) => {
    const requests = fakeHelper(state)
    let finish!: (result: SubscriptionCheckoutResult) => void
    open().mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderInRouter(<VendorBillingPrototype />)
    const pay = await payButton()
    expect(screen.getByText('Opens Razorpay Checkout. Pay by card — about a minute.')).toBeTruthy()
    fireEvent.click(pay)
    fireEvent.click(pay)
    await waitFor(() => expect(checkout.openSubscriptionCheckout).toHaveBeenCalledTimes(1))
    expect(pay.hasAttribute('disabled')).toBe(true)
    finish(submitted())

    expect(await screen.findByText('Shop is open')).toBeTruthy()
    expect(screen.getByText('You paid ₹299 via Razorpay. Shop stays open until 23 Oct. Next ₹299 is charged on 24 Oct.')).toBeTruthy()
    expect(screen.queryByText(/^Sample: /)).toBeNull()
    expect(chip('Paid').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('status', { name: 'Shop plan status' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Payments you made' })).getAllByRole('listitem')[0].textContent).toBe('Paid ₹299Shop open until 23 Oct · Today')
    expect(posts(requests, 'preparations').map((request) => request.body?.action)).toEqual(['pay_first_fee'])
    expect(posts(requests, 'submissions')[0].body).toEqual({ attemptId: 'lt_proto1', subscriptionId: 'sub_proto1', paymentId: 'pay_proto2', signature: 'b'.repeat(64) })
    expect(posts(requests, 'resets')).toHaveLength(0)
  })

  const lostResult = 'Checkout finished, but its result did not reach the local helper, so this shows what Razorpay Test reports. If the payment is not shown yet, refresh Plan in a moment rather than paying again.'

  it('rereads the helper when the Checkout result does not reach it, and shows the paid ₹299 rather than the helper as down', async () => {
    const requests = fakeHelper('payment_failed', { loseSubmission: true })
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await payButton())
    expect(await screen.findByText('Shop is open')).toBeTruthy()
    expect(screen.getByText(lostResult)).toBeTruthy()
    expect(screen.queryByText(/Start it with npm run dev:billing-helper/)).toBeNull()
    expect(posts(requests, 'submissions')).toHaveLength(1)
  })

  it('reports the helper down only once the reread after a lost Checkout result also fails', async () => {
    fakeHelper('payment_failed')
    open().mockImplementation(async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))
      return submitted()
    })
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await payButton())
    expect(await screen.findByText(/Start it with npm run dev:billing-helper/)).toBeTruthy()
    expect(screen.getByText(lostResult)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay ₹299 with Razorpay' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows Confirming payment… rather than Paid until Razorpay Test shows the ₹299 captured', async () => {
    const requests = fakeHelper('payment_failed', { payment: 'pending' })
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await payButton())
    expect(await screen.findByText('Confirming payment… Razorpay Test has not confirmed the ₹299 yet, so nothing has changed. Check again in a moment.')).toBeTruthy()
    expect(screen.queryByText('Shop is open')).toBeNull()
    expect(screen.getByRole('button', { name: 'Pay ₹299 with Razorpay' }).hasAttribute('disabled')).toBe(true)
    expect(chip('Payment failed').getAttribute('aria-pressed')).toBe('true')
    requests.capture()
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText('Shop is open')).toBeTruthy()
    expect(screen.queryByText(/^Confirming payment/)).toBeNull()
  })

  it('leaves the state unchanged with a notice when Checkout is closed, and reuses the preparation on retry', async () => {
    const requests = fakeHelper('shop_closed')
    open().mockResolvedValue({ status: 'dismissed' })
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await payButton())
    expect(await screen.findByText('Checkout was closed before the ₹299 was paid. Nothing changed; your shop is still hidden.')).toBeTruthy()
    expect(screen.getByText('Shop is hidden')).toBeTruthy()
    expect(chip('Shop closed').getAttribute('aria-pressed')).toBe('true')
    expect(posts(requests, 'submissions')).toHaveLength(0)
    const retry = await payButton()
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false))
    fireEvent.click(retry)
    await waitFor(() => expect(checkout.openSubscriptionCheckout).toHaveBeenCalledTimes(2))
    const keys = posts(requests, 'preparations').map((request) => request.body?.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })

  it('reports a failed card payment and leaves the state unchanged', async () => {
    fakeHelper('payment_failed')
    open().mockImplementation(async (_config, options) => {
      options?.onPaymentFailure?.('Your payment was declined by the bank.')
      return { status: 'dismissed' }
    })
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await payButton())
    expect(await screen.findByText('The card payment did not go through (Your payment was declined by the bank.). Nothing changed; your shop is still hidden.')).toBeTruthy()
    expect(screen.getByText('Shop is hidden')).toBeTruthy()
    expect(screen.queryByText('Shop is open')).toBeNull()
  })
})

describe('VendorBillingPrototype trial AutoPay', () => {
  /** Hosted Razorpay Checkout is stubbed at its export seam; no test reaches Razorpay. */
  const open = () => vi.spyOn(checkout, 'openSubscriptionCheckout')
  const callback = { razorpay_payment_id: 'pay_proto1', razorpay_subscription_id: 'sub_proto1', razorpay_signature: 'a'.repeat(64) }
  const submitted = (): SubscriptionCheckoutResult => ({ status: 'submitted', callback: { ...callback } })
  const posts = (requests: ReturnType<typeof fakeHelper>, operation: string) => requests.filter((request) => request.method === 'POST' && request.path === `/vendors/r1-prototype/${operation}`)
  const historyRows = () => within(screen.getByRole('region', { name: 'Payments you made' })).getAllByRole('listitem').map((item) => item.textContent)

  it.each([
    ['free_days', '6 Oct', '12'],
    ['three_days_left', '27 Sept', '3'],
  ] as const)('sets up AutoPay in %s through one hosted Checkout and stays in the same state', async (state, trialEnd, days) => {
    const requests = fakeHelper(state)
    let finish!: (result: SubscriptionCheckoutResult) => void
    open().mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderInRouter(<VendorBillingPrototype />)
    const setUp = await screen.findByRole('button', { name: `Set up AutoPay · ₹299 on ${trialEnd}` })
    expect(screen.getByText(`Opens Razorpay Checkout. Your card is checked with a refundable ₹5 charge now; the first ₹299 is charged on ${trialEnd}, when free days end.`)).toBeTruthy()
    fireEvent.click(setUp)
    fireEvent.click(setUp)
    await waitFor(() => expect(checkout.openSubscriptionCheckout).toHaveBeenCalledTimes(1))
    expect(vi.mocked(checkout.openSubscriptionCheckout).mock.calls[0][0]).toMatchObject({ keyId: 'rzp_test_placeholder', subscriptionId: 'sub_proto1' })
    expect(setUp.hasAttribute('disabled')).toBe(true)
    finish(submitted())

    expect(await screen.findByText(`AutoPay on — first ₹299 on ${trialEnd}`)).toBeTruthy()
    expect(screen.getByText(days)).toBeTruthy()
    expect(screen.getByRole('button', { name: prototypeStateLabels[state], pressed: true })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Set up AutoPay/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Turn off AutoPay' })).toBeTruthy()
    expect(screen.queryByText('Shop is open')).toBeNull()
    expect(screen.getByRole('status', { name: 'Shop plan status' }).textContent).toBe(`${days} free days left — AutoPay is on, so the first ₹299 is charged on ${trialEnd}.Shop plan`)
    expect(historyRows()[0]).toBe(`AutoPay onFirst ₹299 on ${trialEnd} · Today`)
    expect(posts(requests, 'preparations')).toHaveLength(1)
    expect(posts(requests, 'preparations')[0].body).toMatchObject({ action: 'setup_autopay' })
    expect(posts(requests, 'submissions')[0].body).toEqual({ attemptId: 'lt_proto1', subscriptionId: 'sub_proto1', paymentId: 'pay_proto1', signature: 'a'.repeat(64) })
  })

  it('leaves the state unchanged with a notice when Checkout is closed, and reuses the preparation on retry', async () => {
    const requests = fakeHelper('free_days')
    open().mockResolvedValue({ status: 'dismissed' })
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }))
    expect(await screen.findByText('Checkout was closed before AutoPay was set up. Nothing changed; your free days are the same.')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.queryByText(/^AutoPay on/)).toBeNull()
    expect(posts(requests, 'submissions')).toHaveLength(0)
    const retry = screen.getByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' })
    expect(retry.hasAttribute('disabled')).toBe(false)
    fireEvent.click(retry)
    await waitFor(() => expect(checkout.openSubscriptionCheckout).toHaveBeenCalledTimes(2))
    const keys = posts(requests, 'preparations').map((request) => request.body?.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })

  it('reports a failed card payment and leaves the state unchanged', async () => {
    fakeHelper('three_days_left')
    open().mockImplementation(async (_config, options) => {
      options?.onPaymentFailure?.('Your payment was declined by the bank.')
      return { status: 'dismissed' }
    })
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 27 Sept' }))
    expect(await screen.findByText('The card payment did not go through (Your payment was declined by the bank.), so AutoPay is not set up. Nothing changed; your free days are the same.')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set up AutoPay · ₹299 on 27 Sept' })).toBeTruthy()
  })

  it('says so when Checkout cannot open, without changing the state', async () => {
    fakeHelper('free_days')
    open().mockRejectedValue(new CheckoutBeforeOpenError('Could not load Razorpay. Check your connection and try again.'))
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }))
    expect(await screen.findByText('Could not load Razorpay. Check your connection and try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }).hasAttribute('disabled')).toBe(false)
  })

  it('waits for Razorpay Test confirmation before showing AutoPay on', async () => {
    fakeHelper('free_days', { setup: 'pending' })
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }))
    expect(await screen.findByText('Razorpay Test has not confirmed AutoPay yet, so nothing has changed. Check again in a moment.')).toBeTruthy()
    expect(screen.queryByText(/^AutoPay on/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()
  })

  it('turns AutoPay off through the helper and returns to plain Free days with the trial kept', async () => {
    const requests = fakeHelper('free_days')
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
    expect(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' })).toBeTruthy()
    expect(screen.queryByText('AutoPay on — first ₹299 on 6 Oct')).toBeNull()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Your shop is live for 14 free days. After that, subscribe with Razorpay — ₹299 each month — to keep it open.')).toBeTruthy()
    expect(historyRows().slice(0, 2)).toEqual(['AutoPay turned offCancelled with Razorpay · Today', 'AutoPay onFirst ₹299 on 6 Oct · Today'])
    expect(posts(requests, 'cancellations')).toHaveLength(1)
  })

  it('keeps the helper-read AutoPay on screen when the helper stops mid-action', async () => {
    fakeHelper('free_days')
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }))
    const turnOff = await screen.findByRole('button', { name: 'Turn off AutoPay' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))
    fireEvent.click(turnOff)
    expect(await screen.findByText(/Start it with npm run dev:billing-helper/)).toBeTruthy()
    expect(screen.getByText('AutoPay on — first ₹299 on 6 Oct')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Turn off AutoPay' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps showing AutoPay on until Razorpay Test confirms the turn-off', async () => {
    fakeHelper('free_days', { turnOff: 'acknowledged' })
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up AutoPay · ₹299 on 6 Oct' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off AutoPay' }))
    expect(await screen.findByText('Razorpay Test has not confirmed that AutoPay is off yet, so the first ₹299 may still be charged on 6 Oct. Check again in a moment.')).toBeTruthy()
    expect(screen.getByText('AutoPay on — first ₹299 on 6 Oct')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Turn off AutoPay' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()
  })
})

describe('VendorBillingPrototype stop the plan and keep the shop open', () => {
  /** Hosted Razorpay Checkout is stubbed at its export seam; no test reaches Razorpay. */
  const open = () => vi.spyOn(checkout, 'openSubscriptionCheckout')
  const submitted = (): SubscriptionCheckoutResult => ({ status: 'submitted', callback: { razorpay_payment_id: 'pay_proto3', razorpay_subscription_id: 'sub_proto1', razorpay_signature: 'c'.repeat(64) } })
  const posts = (requests: ReturnType<typeof fakeHelper>, operation: string) => requests.filter((request) => request.method === 'POST' && request.path === `/vendors/r1-prototype/${operation}`)
  const historyRows = () => within(screen.getByRole('region', { name: 'Payments you made' })).getAllByRole('listitem').map((item) => item.textContent)
  const stopSection = () => screen.getByRole('region', { name: 'Stop the plan' })

  it('asks once before stopping the sample Paid, then shows Stopped with the same paid-through and no provider call', async () => {
    const requests = fakeHelper('paid')
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByText('Shop is open')
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Stop the plan' }))
    expect(within(stopSection()).getByText('Stop the plan? No more ₹299 is charged. Your shop stays open until 24 Oct, then customers cannot see it.')).toBeTruthy()
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Keep the plan' }))
    expect(within(stopSection()).queryByText(/^Stop the plan\?/)).toBeNull()
    expect(posts(requests, 'cancellations')).toHaveLength(0)

    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Stop the plan' }))
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Yes, stop the plan' }))
    expect(await screen.findByText('You stopped the plan. Shop stays open until 24 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')).toBeTruthy()
    expect(screen.getByText('30')).toBeTruthy()
    expect(chip('Stopped').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('region', { name: 'Stop the plan' })).toBeNull()
    expect(screen.queryByText(/local helper's record/)).toBeNull()
    expect(historyRows()[0]).toBe('Plan stoppedShop stays open until paid days end · Today')
    expect(posts(requests, 'cancellations')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Keep shop open · ₹299' }).hasAttribute('disabled')).toBe(false)
  })

  it("stops a real Paid at cycle end and says Stopped comes from the helper's record", async () => {
    fakeHelper('payment_failed')
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay ₹299 with Razorpay' }))
    await screen.findByText('Shop is open')
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Stop the plan' }))
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Yes, stop the plan' }))
    expect(await screen.findByText('You stopped the plan. Shop stays open until 23 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')).toBeTruthy()
    expect(screen.getByText("Razorpay Test accepted a stop at the end of the paid days. Its reads cannot show a scheduled stop, so this comes from the local helper's record of that acceptance.")).toBeTruthy()
  })

  it('leaves Paid unchanged with the error when the stop is not confirmed, and retries with the same key', async () => {
    const requests = fakeHelper('paid', { failStops: 1 })
    renderInRouter(<VendorBillingPrototype />)
    await screen.findByText('Shop is open')
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Stop the plan' }))
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Yes, stop the plan' }))
    expect(await screen.findByText(/cancellation outcome is uncertain/)).toBeTruthy()
    expect(screen.getByText('Shop is open')).toBeTruthy()
    expect(chip('Paid').getAttribute('aria-pressed')).toBe('true')
    const retry = within(stopSection()).getByRole('button', { name: 'Yes, stop the plan' })
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false))
    fireEvent.click(retry)
    expect(await screen.findByText(/^You stopped the plan\./)).toBeTruthy()
    const keys = posts(requests, 'cancellations').map((request) => request.body?.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })

  it('keeps Paid with a notice until Razorpay Test confirms an immediate stop', async () => {
    fakeHelper('stopped', { stop: 'unconfirmed' })
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep shop open · ₹299' }))
    await screen.findByText('Shop is open')
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Stop the plan' }))
    fireEvent.click(within(stopSection()).getByRole('button', { name: 'Yes, stop the plan' }))
    expect(await screen.findByText('Razorpay Test has not confirmed the stop yet, so the plan is still on. Check again in a moment.')).toBeTruthy()
    expect(chip('Paid').getAttribute('aria-pressed')).toBe('true')
    expect(within(stopSection()).getByRole('button', { name: 'Stop the plan' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps the shop open through one future-start Checkout and returns to Paid with the same paid-through', async () => {
    const requests = fakeHelper('stopped')
    let finish!: (result: SubscriptionCheckoutResult) => void
    open().mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderInRouter(<VendorBillingPrototype />)
    const keep = await screen.findByRole('button', { name: 'Keep shop open · ₹299' })
    expect(screen.getByText('Opens Razorpay Checkout. Your card is checked with a refundable ₹5 charge now; ₹299 is charged on 2 Oct, when paid days end.')).toBeTruthy()
    fireEvent.click(keep)
    fireEvent.click(keep)
    await waitFor(() => expect(checkout.openSubscriptionCheckout).toHaveBeenCalledTimes(1))
    finish(submitted())

    expect(await screen.findByText('Shop is open')).toBeTruthy()
    expect(screen.getByText('You paid ₹299 via Razorpay. Shop stays open until 2 Oct. Next ₹299 is charged on 2 Oct.')).toBeTruthy()
    expect(screen.getByText('Sample: the paid days are seeded, so no ₹299 was taken. AutoPay for the next ₹299 is set up with Razorpay Test.')).toBeTruthy()
    expect(chip('Paid').getAttribute('aria-pressed')).toBe('true')
    expect(historyRows()[0]).toBe('AutoPay set up againNext ₹299 on 2 Oct · Today')
    expect(posts(requests, 'preparations').map((request) => request.body?.action)).toEqual(['setup_autopay'])
    expect(posts(requests, 'resets')).toHaveLength(0)
  })

  it('leaves Stopped unchanged with a notice when Checkout is closed or the card fails', async () => {
    fakeHelper('stopped')
    const opened = open().mockResolvedValueOnce({ status: 'dismissed' })
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep shop open · ₹299' }))
    expect(await screen.findByText('Checkout was closed before AutoPay was set up again. Nothing changed; the plan is still stopped.')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    opened.mockImplementationOnce(async (_config, options) => {
      options?.onPaymentFailure?.('Your payment was declined by the bank.')
      return { status: 'dismissed' }
    })
    const retry = screen.getByRole('button', { name: 'Keep shop open · ₹299' })
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false))
    fireEvent.click(retry)
    expect(await screen.findByText('The card payment did not go through (Your payment was declined by the bank.), so AutoPay is not set up again. Nothing changed; the plan is still stopped.')).toBeTruthy()
    expect(chip('Stopped').getAttribute('aria-pressed')).toBe('true')
  })

  it('waits for Razorpay Test to confirm Keep shop open before showing Paid', async () => {
    fakeHelper('stopped', { setup: 'pending' })
    open().mockResolvedValue(submitted())
    renderInRouter(<VendorBillingPrototype />)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep shop open · ₹299' }))
    expect(await screen.findByText('Razorpay Test has not confirmed AutoPay yet, so nothing has changed. Check again in a moment.')).toBeTruthy()
    expect(screen.queryByText('Shop is open')).toBeNull()
    expect(screen.getByRole('button', { name: 'Keep shop open · ₹299' }).hasAttribute('disabled')).toBe(true)
  })
})
