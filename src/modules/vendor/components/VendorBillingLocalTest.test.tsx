// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as checkout from '@/shared/payments/razorpay-checkout'
import { VendorBillingLocalTest } from './VendorBillingLocalTest'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const vendorId = 'vendor-1'
const trialRecord = {
  vendorId, scenario: 'active_trial', revision: 1, serverTime: '2026-09-23T10:00:00Z', trialStatus: 'active',
  trialEndsAt: '2026-10-07T10:00:00.000Z', paidThrough: null, daysRemaining: 14, accessStatus: 'TRIAL', storeVisible: true,
  attempts: [], associations: [], availableActions: ['setup_autopay'], authorisationStatus: 'not_configured', paymentStatus: 'none',
  nextChargeAt: null, providerVerified: { authorisation: false, payment: false }, providerCheck: 'current',
}
const preparedAttempt = {
  attemptId: 'lt_attempt1', vendorId, action: 'setup_autopay', mode: 'provider',
  config: { keyId: 'rzp_test_public', subscriptionId: 'sub_helper1', name: 'MithraDirect', description: 'Vendor platform membership · local Razorpay Test Mode' },
  expected: { amountMinor: 29900, currency: 'INR', chargeAt: '2026-10-07T10:00:00.000Z', authorisationAmountMinor: null },
  expiresAt: '2999-01-01T00:00:00.000Z',
}

type Reply = { status: number; body: unknown }

/** A local helper stand-in at the browser fetch edge; it never reaches Razorpay. */
const pendingAfterCallback = { ...trialRecord, revision: 4, authorisationStatus: 'pending', availableActions: [], attempts: [{ action: 'setup_autopay', state: 'callback_verified', associationId: 'sub_helper1' }] }

function stubHelper(
  prepare: () => Reply | Promise<Reply> = () => ({ status: 200, body: { attempt: preparedAttempt, record: { ...trialRecord, revision: 3 } } }),
  afterCallback: Record<string, unknown> = pendingAfterCallback,
) {
  let record: Record<string, unknown> = { ...trialRecord }
  let cancelReply: (() => Reply) | null = null
  const calls: Array<{ method: string; operation: string; body: Record<string, unknown> | null }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const operation = url.split('/').at(-1) ?? ''
    const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : null
    calls.push({ method: options?.method ?? 'GET', operation, body })
    let reply: Reply = { status: 200, body: { record } }
    if (operation === 'preparations') reply = await prepare()
    if (operation === 'cancellations' && cancelReply) reply = cancelReply()
    // The helper acknowledges the callback; the following status read reports provider facts.
    if (operation === 'submissions') {
      reply = { status: 200, body: { record: { ...record, revision: 4, attempts: [{ action: 'setup_autopay', state: 'callback_verified', associationId: 'sub_helper1' }] } } }
      record = afterCallback
    }
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body }
  }))
  return {
    calls, setRecord: (next: Record<string, unknown>) => { record = next },
    /** The helper's answer to a cancellation request; it may also change what the next status read returns. */
    onCancel: (reply: () => Reply) => { cancelReply = reply },
  }
}

async function payNow() {
  fireEvent.click(await screen.findByRole('button', { name: 'Pay Now' }))
}

describe('VendorBillingLocalTest Checkout', () => {
  it('opens only the helper-prepared Test subscription and keeps its callback pending verification', async () => {
    const helper = stubHelper()
    const callback = { razorpay_payment_id: 'pay_local', razorpay_subscription_id: 'sub_helper1', razorpay_signature: 'sig_local' }
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText(/first monthly platform fee is scheduled/)).toHaveProperty('textContent', expect.stringContaining('7 Oct 2026'))
    await payNow()
    await screen.findByText(/Verification is pending/)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0][0]).toEqual(preparedAttempt.config)
    const preparation = helper.calls.find((call) => call.operation === 'preparations')
    expect(preparation?.body).toEqual({ action: 'setup_autopay', idempotencyKey: expect.any(String) })
    const submission = helper.calls.find((call) => call.operation === 'submissions')
    expect(submission?.body).toEqual({ attemptId: 'lt_attempt1', subscriptionId: 'sub_helper1', paymentId: 'pay_local', signature: 'sig_local' })
    expect(helper.calls.at(-1)?.operation).toBe('status')
    expect(callback).toEqual({ razorpay_payment_id: '', razorpay_subscription_id: '', razorpay_signature: '' })
    expect(screen.getByText('Confirmation pending')).toBeTruthy()
    expect(screen.queryByText('Confirmed')).toBeNull()
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Simulate/ })).toBeNull()
    expect(screen.queryByText('Razorpay Test verified')).toBeNull()
    expect(screen.getByText(/callback signature verified by the helper, Razorpay Test confirmation pending/)).toBeTruthy()
  })

  it('shows provider-confirmed AutoPay while the original trial boundary and first fee date remain', async () => {
    const helper = stubHelper(undefined, {
      ...trialRecord, revision: 5, availableActions: [], authorisationStatus: 'confirmed', nextChargeAt: '2026-10-07T10:00:00.000Z',
      providerVerified: { authorisation: true, payment: false }, attempts: [{ action: 'setup_autopay', state: 'authorised', associationId: 'sub_helper1' }],
    })
    vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback: { razorpay_payment_id: 'pay_local', razorpay_subscription_id: 'sub_helper1', razorpay_signature: 'sig_local' } })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    await payNow()
    expect(await screen.findByText('Confirmed')).toBeTruthy()
    expect(screen.getByText(/shows only what has been confirmed/)).toBeTruthy()
    expect(screen.getAllByText('Razorpay Test verified')).toHaveLength(1)
    expect(screen.getByText('No confirmed payment')).toBeTruthy()
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.getByText(/Trial access until/)).toHaveProperty('textContent', expect.stringContaining('7 Oct 2026'))
    expect(screen.getByText(/Next platform fee scheduled for/)).toHaveProperty('textContent', expect.stringContaining('7 Oct 2026'))
    expect(screen.getByText(/Razorpay Test verified: AutoPay authorisation\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    expect(helper.calls.filter((call) => call.operation === 'preparations')).toHaveLength(1)
  })

  it('keeps a pending result visible with billing changes paused when Razorpay Test cannot be read', async () => {
    const helper = stubHelper()
    helper.setRecord({ ...trialRecord, providerCheck: 'unavailable', authorisationStatus: 'pending', attempts: [{ action: 'setup_autopay', state: 'callback_verified', associationId: 'sub_helper1' }] })
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText(/could not be read just now/)).toBeTruthy()
    expect(screen.getByText('Confirmation pending')).toBeTruthy()
    expect(screen.queryByText('Razorpay Test verified')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    helper.setRecord({ ...trialRecord, revision: 2, availableActions: [], authorisationStatus: 'confirmed', providerVerified: { authorisation: true, payment: false }, nextChargeAt: '2026-10-07T10:00:00.000Z' })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh billing status' }))
    expect(await screen.findByText('Razorpay Test verified')).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
  })

  it('requires consent when the inspected provider fee differs from the displayed scenario', async () => {
    stubHelper(() => ({ status: 200, body: { attempt: { ...preparedAttempt, expected: { ...preparedAttempt.expected, amountMinor: 39900 } }, record: trialRecord } }))
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'dismissed' })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    await payNow()
    expect(await screen.findByText(/prepared platform fee: ₹399/)).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep current status' }))
    expect(open).not.toHaveBeenCalled()
  })

  it('reads helper status after dismissal and reuses the same logical key on an explicit retry', async () => {
    const helper = stubHelper()
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'dismissed' })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    const reads = () => helper.calls.filter((call) => call.operation === 'status').length
    await screen.findByRole('button', { name: 'Pay Now' })
    const initialReads = reads()
    await payNow()
    await screen.findByText(/Checkout was closed/)
    await waitFor(() => expect(reads()).toBe(initialReads + 1))
    expect(helper.calls.filter((call) => call.operation === 'preparations')).toHaveLength(1)
    await payNow()
    await waitFor(() => expect(open).toHaveBeenCalledTimes(2))
    const keys = helper.calls.filter((call) => call.operation === 'preparations').map((call) => call.body?.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
    expect(helper.calls.some((call) => call.operation === 'submissions')).toBe(false)
  })

  it('shows an uncertain provider failure, reconciles status and opens nothing', async () => {
    const helper = stubHelper(() => ({ status: 504, body: { error: 'The Razorpay Test outcome is uncertain. Refresh billing status; a retry reconciles the same request and never creates a second subscription.' } }))
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    const reads = () => helper.calls.filter((call) => call.operation === 'status').length
    await screen.findByRole('button', { name: 'Pay Now' })
    const initialReads = reads()
    await payNow()
    expect(await screen.findByText(/never creates a second subscription/)).toBeTruthy()
    await waitFor(() => expect(reads()).toBe(initialReads + 1))
    expect(open).not.toHaveBeenCalled()
  })

  it('rejects a live or mismatched preparation before Checkout', async () => {
    stubHelper(() => ({ status: 200, body: { attempt: { ...preparedAttempt, config: { ...preparedAttempt.config, keyId: 'rzp_live_public' } }, record: trialRecord } }))
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    await payNow()
    expect(await screen.findByText(/not a Razorpay Test Mode preparation/)).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
  })

  it('aborts Checkout on teardown and never submits a late callback', async () => {
    const helper = stubHelper()
    let finish!: (value: checkout.SubscriptionCheckoutResult) => void
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const view = render(<VendorBillingLocalTest vendorId={vendorId} />)
    await payNow()
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    const signal = open.mock.calls[0][1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    finish({ status: 'submitted', callback: { razorpay_payment_id: 'pay_late', razorpay_subscription_id: 'sub_helper1', razorpay_signature: 'sig_late' } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(helper.calls.some((call) => call.operation === 'submissions')).toBe(false)
  })

  it('keeps the original boundary and a pending first fee visible after reload', async () => {
    const helper = stubHelper()
    helper.setRecord({
      ...trialRecord, scenario: 'expired_trial', trialStatus: 'ended', trialEndsAt: '2026-09-16T10:00:00.000Z', daysRemaining: 0,
      accessStatus: 'TRIAL_ENDED', storeVisible: false, availableActions: [], paymentStatus: 'pending',
      attempts: [{ action: 'pay_first_fee', attemptId: 'lt_attempt2', state: 'callback_unverified', associationId: 'sub_helper2', expected: { amountMinor: 29900, currency: 'INR', chargeAt: null, authorisationAmountMinor: null } }],
    })
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText('TRIAL_ENDED')).toBeTruthy()
    expect(screen.getByText('Confirmation pending')).toBeTruthy()
    expect(screen.getByText(/Recorded Test preparation: first platform fee ₹299 INR collected now; callback received, verification pending/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('VendorBillingLocalTest renewal and recovery', () => {
  const anchor = '2026-10-23T10:00:00.000Z'
  const second = '2026-11-23T10:00:00.000Z'
  const third = '2026-12-23T10:00:00.000Z'
  const firstFee = { invoiceId: 'inv_1', paymentId: 'pay_1', amountMinor: 29900, currency: 'INR', periodStart: anchor, periodEnd: second }
  const paidRecord = {
    ...trialRecord, scenario: 'paid_sample', revision: 6, serverTime: '2026-09-24T10:00:00Z', trialStatus: 'ended', trialEndsAt: '2026-09-16T10:00:00.000Z',
    daysRemaining: 0, accessStatus: 'PAID', storeVisible: true, availableActions: [], authorisationStatus: 'confirmed', paymentStatus: 'confirmed',
    paidThrough: second, nextChargeAt: second, providerVerified: { authorisation: true, payment: true, coverage: true },
    attempts: [{ action: 'setup_autopay', state: 'fee_confirmed', associationId: 'sub_helper1', fee: firstFee, renewals: [], renewal: null, providerStatus: 'active' }],
  }
  const withRenewal = (renewal: object, changes: object = {}) => ({ ...paidRecord, ...changes, attempts: [{ ...paidRecord.attempts[0], renewal }] })

  it('labels an accelerated Test charge as a provider payment fact only', async () => {
    stubHelper().setRecord(paidRecord)
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText(/Razorpay Test verified: AutoPay authorisation and platform fees captured for/)).toHaveProperty('textContent', expect.stringContaining('23 Oct 2026'))
    expect(screen.getByText(/Test Dashboard accelerated charge is read as a provider payment fact only/)).toHaveProperty('textContent', expect.stringMatching(/does not advance the trial.*backend enforcement/))
    expect(screen.getByText(/Next platform fee scheduled for/)).toHaveProperty('textContent', expect.stringContaining('23 Nov 2026'))
  })

  it('shows a failed renewal before the boundary against the original due date with no grace claim', async () => {
    stubHelper().setRecord(withRenewal({ dueAt: second, status: 'failed', problem: null }, { paymentStatus: 'failed' }))
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText('Failed')).toBeTruthy()
    expect(screen.getByText('PAID')).toBeTruthy()
    expect(screen.getByText(/Platform fee due .* was not collected/)).toHaveProperty('textContent', expect.stringMatching(/23 Nov 2026.*Paid coverage still ends .*23 Nov 2026.*no grace period/))
    expect(screen.getByText(/Razorpay Test shows the platform fee due .* failed/)).toBeTruthy()
    expect(screen.queryByText(/Next platform fee scheduled/)).toBeNull()
  })

  it('restricts only the local demonstration at the boundary and keeps billing and existing orders available', async () => {
    stubHelper().setRecord(withRenewal({ dueAt: second, status: 'failed', problem: null }, {
      serverTime: '2026-11-23T10:00:01Z', paymentStatus: 'failed', accessStatus: 'PAYMENT_REQUIRED', storeVisible: false,
    }))
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText('PAYMENT_REQUIRED')).toBeTruthy()
    expect(screen.getByText('Your paid coverage has ended. There is no grace period.')).toBeTruthy()
    expect(screen.getByText(/Razorpay Test verified fee period ended/)).toHaveProperty('textContent', expect.stringContaining('23 Nov 2026'))
    expect(screen.getByText(/Platform fee due .* was not collected/)).toBeTruthy()
    const restriction = screen.getByText(/Local demonstration only/)
    expect(restriction.textContent).toMatch(/Billing and account remain available.*orders placed before expiry can still be fulfilled/)
    expect(restriction.textContent).toMatch(/does not gate your real storefront or vendor operations/)
  })

  it('shows a recovered retry on the original cycle with the next renewal date unchanged', async () => {
    const renewed = { invoiceId: 'inv_2', paymentId: 'pay_2', amountMinor: 29900, currency: 'INR', periodStart: second, periodEnd: third }
    stubHelper().setRecord({ ...paidRecord, serverTime: '2026-11-25T10:00:00Z', paidThrough: third, nextChargeAt: third,
      attempts: [{ ...paidRecord.attempts[0], renewals: [renewed] }] })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText(/Razorpay Test verified fee period through/)).toHaveProperty('textContent', expect.stringContaining('23 Dec 2026'))
    expect(screen.getByText(/Next platform fee scheduled for/)).toHaveProperty('textContent', expect.stringContaining('23 Dec 2026'))
    expect(screen.getByText(/platform fees captured for/)).toHaveProperty('textContent', expect.stringMatching(/23 Nov 2026.*to 23 Dec 2026/))
    expect(screen.queryByText(/25 Dec 2026/)).toBeNull()
  })

  it('keeps confirmed coverage visible when AutoPay is revoked and flags an uncounted charge', async () => {
    stubHelper().setRecord({ ...withRenewal({ dueAt: second, status: null, problem: 'uncounted' }), authorisationStatus: 'revoked', nextChargeAt: null,
      providerVerified: { authorisation: false, payment: true, coverage: true }, attempts: [{ ...paidRecord.attempts[0], providerStatus: 'cancelled', renewal: { dueAt: second, status: null, problem: 'uncounted' } }] })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText('Revoked')).toBeTruthy()
    expect(screen.getByText('Confirmed paid')).toBeTruthy()
    expect(screen.getByText(/Razorpay Test verified fee period through/)).toHaveProperty('textContent', expect.stringContaining('23 Nov 2026'))
    // Without a helper request, the closure is reported as an external revocation, not a Plan cancellation.
    expect(screen.getByText(/Razorpay Test shows this subscription cancelled outside this Plan page/)).toBeTruthy()
    expect(screen.queryByText(/cancelled at your request/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Cancellation progress' })).toBeNull()
    expect(screen.getByText(/charge that is not the next original billing cycle, so it is not counted/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
  })

  it('labels an ended provider-verified period as verified even when the due fee is only locally simulated', async () => {
    stubHelper().setRecord({ ...paidRecord, serverTime: '2026-11-23T10:00:01Z', paymentStatus: 'pending', accessStatus: 'PAYMENT_REQUIRED', storeVisible: false,
      providerVerified: { authorisation: true, payment: false, coverage: true } })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    expect(await screen.findByText(/Razorpay Test verified fee period ended/)).toBeTruthy()
    expect(screen.queryByText(/Sample paid coverage/)).toBeNull()
    expect(screen.getByText(/Platform fee due .* is awaiting confirmation/)).toBeTruthy()
  })

  it('never calls the paid sample boundary confirmed coverage when offering AutoPay', async () => {
    stubHelper().setRecord({ ...paidRecord, paidThrough: anchor, nextChargeAt: null, paymentStatus: 'none', authorisationStatus: 'not_configured',
      availableActions: ['setup_autopay'], providerVerified: { authorisation: false, payment: false, coverage: false }, attempts: [] })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    const copy = await screen.findByText(/No fee is taken today/)
    expect(copy.textContent).toMatch(/when your sample paid coverage ends/)
    expect(copy.textContent).not.toMatch(/confirmed paid coverage/)
    expect(screen.getByText(/Sample paid coverage through/)).toBeTruthy()
  })
})
describe('VendorBillingLocalTest cancellation and rejoining', () => {
  const trialEnd = '2026-10-07T10:00:00.000Z'
  const authorisedTrial = {
    ...trialRecord, revision: 5, availableActions: ['cancel'], authorisationStatus: 'confirmed', nextChargeAt: trialEnd,
    providerVerified: { authorisation: true, payment: false, coverage: false }, cancellation: null,
    attempts: [{ action: 'setup_autopay', state: 'authorised', associationId: 'sub_helper1', expected: preparedAttempt.expected }],
  }
  const trialCancellation = (stage: string, changes: object = {}) => ({
    ...authorisedTrial, revision: 6, availableActions: [],
    cancellation: { status: stage === 'acknowledged' ? 'requested' : stage, stage, mode: 'immediate', requestedAt: '2026-09-23T10:00:00.000Z', effectiveAt: null },
    attempts: [{ ...authorisedTrial.attempts[0], cancellation: { state: stage, effectiveAt: null } }], ...changes,
  })
  const confirmedTrial = trialCancellation('confirmed', {
    revision: 7, availableActions: ['setup_autopay'], authorisationStatus: 'revoked', nextChargeAt: null,
    providerVerified: { authorisation: false, payment: false, coverage: false },
    cancellation: { status: 'confirmed', stage: 'confirmed', mode: 'immediate', requestedAt: '2026-09-23T10:00:00.000Z', effectiveAt: '2026-09-23T10:05:00.000Z' },
    attempts: [{ action: 'setup_autopay', state: 'provider_closed', associationId: 'sub_helper1', cancellation: { state: 'confirmed', effectiveAt: '2026-09-23T10:05:00.000Z' } }],
  })

  async function confirmCancellation() {
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
  }

  it('asks for a second click quoting the trial expiry, then shows an acknowledged stop as requested only', async () => {
    const helper = stubHelper()
    helper.setRecord(authorisedTrial)
    helper.onCancel(() => { helper.setRecord(trialCancellation('acknowledged')); return { status: 200, body: { record: trialCancellation('acknowledged') } } })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    const confirmation = screen.getByRole('group', { name: 'Confirm cancellation' })
    expect(confirmation.textContent).toMatch(/You keep your trial until 7 Oct 2026.*first fee is not taken/)
    expect(helper.calls.some((call) => call.operation === 'cancellations')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    expect(await screen.findByText('Cancellation requested')).toBeTruthy()
    expect(helper.calls.filter((call) => call.operation === 'cancellations').map((call) => call.body)).toEqual([{ idempotencyKey: expect.any(String) }])
    // The acknowledgement is followed by a fresh read; neither claims collection stopped.
    expect(helper.calls.at(-1)?.operation).toBe('status')
    expect(screen.getByText(/Stopping future collection is not confirmed yet/)).toBeTruthy()
    expect(screen.getByText(/accepted the request to stop AutoPay now. It is shown cancelled only once a status read confirms it/)).toBeTruthy()
    expect(screen.queryByText('Cancellation confirmed')).toBeNull()
    expect(screen.queryByText(/Simulated · cancellation progress/)).toBeNull()
    expect(screen.getByText(/Trial access until/)).toHaveProperty('textContent', expect.stringContaining('7 Oct 2026'))
    expect(screen.getByText(/Next platform fee scheduled for/)).toHaveProperty('textContent', expect.stringContaining('7 Oct 2026'))
    expect(screen.queryByRole('button', { name: 'Cancel AutoPay' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
  })

  it('shows a read-confirmed stop with the trial kept, then rejoins at the same expiry and clears the label', async () => {
    const callback = { razorpay_payment_id: 'pay_local', razorpay_subscription_id: 'sub_helper3', razorpay_signature: 'sig_local' }
    const rejoined = {
      ...authorisedTrial, revision: 9, availableActions: [], authorisationStatus: 'pending', nextChargeAt: null, cancellation: null,
      providerVerified: { authorisation: false, payment: false, coverage: false },
      attempts: [confirmedTrial.attempts[0], { action: 'setup_autopay', state: 'callback_verified', associationId: 'sub_helper3', expected: preparedAttempt.expected }],
    }
    const helper = stubHelper(
      () => ({ status: 200, body: { attempt: { ...preparedAttempt, attemptId: 'lt_attempt3', config: { ...preparedAttempt.config, subscriptionId: 'sub_helper3' } }, record: confirmedTrial } }),
      rejoined,
    )
    helper.setRecord(confirmedTrial)
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout').mockResolvedValue({ status: 'submitted', callback })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    const progress = await screen.findByRole('region', { name: 'Cancellation progress' })
    expect(progress.textContent).toMatch(/Cancellation confirmed Razorpay Test verified/)
    expect(progress.textContent).toMatch(/You keep your trial until 7 Oct 2026/)
    expect(screen.getByText('Revoked')).toBeTruthy()
    expect(screen.getByText('TRIAL')).toBeTruthy()
    expect(screen.getByText(/cancelled at your request. A cancellation is not a refund; no refund was requested/)).toBeTruthy()
    expect(screen.getByText(/Cancellation-race and refund progress appear only in the labelled simulated billing samples, and this helper requests no Test refund/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Refund progress' })).toBeNull()
    expect(screen.queryByText(/Next platform fee scheduled/)).toBeNull()
    expect(screen.getByText(/sets up AutoPay again during your existing trial; it does not start a new trial/)).toHaveProperty('textContent', expect.stringContaining('7 Oct 2026'))
    await payNow()
    await screen.findByText(/Verification is pending/)
    // The prepared replacement starts at the displayed expiry, so Checkout opens without a schedule prompt.
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0][0]).toMatchObject({ subscriptionId: 'sub_helper3' })
    expect(screen.queryByRole('region', { name: 'Cancellation progress' })).toBeNull()
    expect(screen.getByText(/An earlier Test AutoPay agreement was cancelled at your request.*a new AutoPay setup replaces it/)).toBeTruthy()
    expect(screen.getByText(/Trial access until/)).toHaveProperty('textContent', expect.stringContaining('14 days remaining'))
  })

  it('requires consent before a replacement Checkout whose schedule differs from the displayed boundary', async () => {
    const shifted = { ...preparedAttempt, expected: { ...preparedAttempt.expected, chargeAt: '2026-10-09T10:00:00.000Z' } }
    const helper = stubHelper(() => ({ status: 200, body: { attempt: shifted, record: confirmedTrial } }))
    helper.setRecord(confirmedTrial)
    const open = vi.spyOn(checkout, 'openSubscriptionCheckout')
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    await payNow()
    expect(await screen.findByRole('button', { name: 'Confirm updated schedule' })).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
  })

  it('schedules a paid-cycle stop distinctly from terminal cancellation and keeps paid access with no prorated refund', async () => {
    const second = '2026-11-23T10:00:00.000Z'
    const fee = { invoiceId: 'inv_1', paymentId: 'pay_1', amountMinor: 29900, currency: 'INR', periodStart: '2026-10-23T10:00:00.000Z', periodEnd: second }
    const paid = {
      ...trialRecord, scenario: 'paid_sample', revision: 6, trialStatus: 'ended', trialEndsAt: '2026-09-16T10:00:00.000Z', daysRemaining: 0,
      accessStatus: 'PAID', availableActions: ['cancel'], authorisationStatus: 'confirmed', paymentStatus: 'confirmed', paidThrough: second, nextChargeAt: second,
      providerVerified: { authorisation: true, payment: true, coverage: true }, cancellation: null,
      attempts: [{ action: 'setup_autopay', state: 'fee_confirmed', associationId: 'sub_helper1', fee, renewals: [], renewal: null, providerStatus: 'active' }],
    }
    const scheduled = {
      ...paid, revision: 7, availableActions: [], nextChargeAt: null,
      cancellation: { status: 'scheduled', stage: 'scheduled', mode: 'cycle_end', requestedAt: '2026-09-24T10:00:00.000Z', effectiveAt: second },
      attempts: [{ ...paid.attempts[0], cancellation: { state: 'scheduled', effectiveAt: second } }],
    }
    const helper = stubHelper()
    helper.setRecord(paid)
    helper.onCancel(() => { helper.setRecord(scheduled); return { status: 200, body: { record: scheduled } } })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }))
    expect(screen.getByRole('group', { name: 'Confirm cancellation' }).textContent).toMatch(/paid access through 23 Nov 2026.*no automatic prorated refund/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    const progress = await screen.findByRole('region', { name: 'Cancellation progress' })
    expect(progress.textContent).toMatch(/Renewal cancellation scheduled.*23 Nov 2026.*not yet a completed cancellation.*No further platform fee is scheduled/)
    expect(screen.queryByText('Cancellation confirmed')).toBeNull()
    expect(screen.getByText('Confirmed paid')).toBeTruthy()
    expect(screen.getByText('PAID')).toBeTruthy()
    expect(screen.getByText(/stays active until then, and a replacement is offered only once Razorpay Test shows it cancelled/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
  })

  it('reports a confirmed paid stop as a Plan cancellation rather than an external revocation, keeping paid coverage', async () => {
    const second = '2026-11-23T10:00:00.000Z'
    const fee = { invoiceId: 'inv_1', paymentId: 'pay_1', amountMinor: 29900, currency: 'INR', periodStart: '2026-10-23T10:00:00.000Z', periodEnd: second }
    const cancellation = { status: 'confirmed', stage: 'confirmed', mode: 'cycle_end', requestedAt: '2026-09-24T10:00:00.000Z', effectiveAt: '2026-10-01T10:00:00.000Z' }
    stubHelper().setRecord({
      ...trialRecord, scenario: 'paid_sample', revision: 8, trialStatus: 'ended', trialEndsAt: '2026-09-16T10:00:00.000Z', daysRemaining: 0,
      accessStatus: 'PAID', availableActions: ['setup_autopay'], authorisationStatus: 'revoked', paymentStatus: 'confirmed', paidThrough: second, nextChargeAt: null,
      providerVerified: { authorisation: false, payment: true, coverage: true }, cancellation,
      attempts: [{ action: 'setup_autopay', state: 'fee_confirmed', associationId: 'sub_helper1', fee, renewals: [], renewal: null, providerStatus: 'cancelled', cancellation: { state: 'confirmed', effectiveAt: cancellation.effectiveAt } }],
    })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    const progress = await screen.findByRole('region', { name: 'Cancellation progress' })
    expect(progress.textContent).toMatch(/Cancellation confirmed.*1 Oct 2026.*paid access through 23 Nov 2026/)
    expect(screen.getByText(/cancelled at your request/)).toBeTruthy()
    expect(screen.queryByText(/outside this Plan page/)).toBeNull()
    expect(screen.getByText('Confirmed paid')).toBeTruthy()
    expect(screen.getByText(/No fee is taken today/)).toHaveProperty('textContent', expect.stringMatching(/23 Nov 2026.*when your confirmed paid coverage ends/))
  })

  it('keeps an unanswered request unconfirmed after a lost response and lets only the same cancellation be retried', async () => {
    const uncertain = trialCancellation('requested', { availableActions: ['cancel'] })
    const helper = stubHelper()
    helper.setRecord(authorisedTrial)
    helper.onCancel(() => {
      helper.setRecord(uncertain)
      return { status: 504, body: { error: 'The Razorpay Test cancellation outcome is uncertain, so future collection is not shown as stopped. Refresh billing status to reconcile it.' } }
    })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    await confirmCancellation()
    expect(await screen.findByText(/future collection is not shown as stopped/)).toBeTruthy()
    expect(await screen.findByText('Cancellation requested')).toBeTruthy()
    expect(helper.calls.at(-1)?.operation).toBe('status')
    expect(screen.getByText(/has not confirmed receiving it, so AutoPay may still collect/)).toBeTruthy()
    expect(screen.getByText(/Next platform fee scheduled for/)).toHaveProperty('textContent', expect.stringContaining('7 Oct 2026'))
    expect(screen.queryByText('Cancellation confirmed')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel AutoPay' })).toBeTruthy()
  })

  it('shows a rejected request as not confirmed with collection continuing', async () => {
    const failed = trialCancellation('failed', { availableActions: ['cancel'] })
    const helper = stubHelper()
    helper.setRecord(authorisedTrial)
    helper.onCancel(() => { helper.setRecord(failed); return { status: 502, body: { error: 'Razorpay Test rejected the request: subscription cannot be cancelled. Future collection has not been stopped.' } } })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    await confirmCancellation()
    expect(await screen.findByText('Cancellation not confirmed')).toBeTruthy()
    expect(screen.getByText(/Future collection has not been stopped/)).toBeTruthy()
    expect(screen.getByText(/rejected the cancellation request, so AutoPay can still collect/)).toBeTruthy()
    expect(screen.getByText('Confirmed')).toBeTruthy()
  })
})

describe('VendorBillingLocalTest reset', () => {
  const recorded = { ...trialRecord, generation: 1, availableActions: ['cancel'], authorisationStatus: 'confirmed', attempts: [{ action: 'setup_autopay', state: 'authorised', associationId: 'sub_helper1' }] }
  const history = [{
    generation: 1, scenario: 'active_trial', selectedAt: '2026-09-23T10:00:00.000Z', trialEndsAt: '2026-10-07T10:00:00.000Z', paidThrough: null,
    resetRequestedAt: '2026-09-24T10:00:00.000Z', resetCompletedAt: '2026-09-24T10:00:00.000Z',
    attempts: [{ action: 'setup_autopay', state: 'authorised', associationId: 'sub_helper1', fee: null, renewals: [] }],
    objects: [{ attemptId: 'lt_attempt1', associationId: 'sub_helper1', action: 'setup_autopay', outcome: 'cancelled_by_reset', providerStatus: 'cancelled' }],
  }]

  /** A per-vendor helper stand-in at the browser fetch edge; it never reaches Razorpay. */
  function stubVendors(state: Record<string, { record: Record<string, unknown> | null; history: unknown[] }>, onReset: (vendor: string) => { record: Record<string, unknown> | null; history: unknown[] }) {
    const calls: Array<{ vendor: string; operation: string; body: Record<string, unknown> | null }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      const [vendor, operation] = url.split('/').slice(-2)
      const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : null
      calls.push({ vendor, operation, body })
      if (operation === 'resets') state[vendor] = onReset(vendor)
      if (operation === 'scenario') state[vendor] = { ...state[vendor], record: { ...trialRecord, vendorId: vendor, generation: 2, scenario: body?.scenario } }
      return { ok: true, status: 200, json: async () => state[vendor] }
    }))
    return calls
  }

  it('resets only after a two-step confirmation naming the vendor, scenario and provider reach, then keeps history', async () => {
    const calls = stubVendors({ [vendorId]: { record: recorded, history: [] } }, () => ({ record: null, history }))
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reset Test scenario' }))
    const confirmation = await screen.findByRole('group', { name: 'Confirm Test scenario reset' })
    expect(confirmation.textContent).toContain('Reset the Active trial scenario (generation 1) for vendor vendor-1?')
    expect(confirmation.textContent).toContain('rereads the 1 Razorpay Test subscription it recorded')
    expect(confirmation.textContent).toContain('that is not a provider cancellation')
    expect(confirmation.textContent).toContain("outside reset's reach")
    fireEvent.click(screen.getByRole('button', { name: 'Keep scenario' }))
    expect(calls.some((call) => call.operation === 'resets')).toBe(false)
    // Reading, rendering and declining never reset or replace anything.
    expect(new Set(calls.map((call) => call.operation))).toEqual(new Set(['status']))

    fireEvent.click(screen.getByRole('button', { name: 'Reset Test scenario' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm reset' }))
    expect(await screen.findByText(/Choose a scenario to start generation 2/)).toBeTruthy()
    expect(calls.find((call) => call.operation === 'resets')?.body).toEqual({ scenario: 'active_trial', generation: 1, idempotencyKey: expect.any(String) })
    const earlier = screen.getByRole('region', { name: 'Earlier Test scenarios' })
    expect(earlier.textContent).toContain('Generation 1 · Active trial')
    expect(earlier.textContent).toContain('sub_helper1: cancelled by reset, confirmed by a Razorpay Test read.')
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    expect(calls.some((call) => call.operation === 'scenario' || call.operation === 'preparations')).toBe(false)

    // A fresh generation starts only when the operator chooses it.
    fireEvent.click(screen.getByRole('button', { name: 'Expired trial' }))
    expect(await screen.findByText(/generation 2\. Reloading/)).toBeTruthy()
    expect(calls.find((call) => call.operation === 'scenario')?.body).toEqual({ scenario: 'expired_trial' })
    expect(screen.getByRole('region', { name: 'Earlier Test scenarios' })).toBeTruthy()
  })

  it('re-reads the helper before confirming, so the count covers subscriptions created since Plan opened', async () => {
    const state = { [vendorId]: { record: { ...trialRecord, generation: 1 } as Record<string, unknown>, history: [] as unknown[] } }
    const calls = stubVendors(state, () => { throw new Error('No reset expected') })
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    await screen.findByRole('button', { name: 'Pay Now' })
    // A Checkout since mount recorded one subscription at the helper.
    state[vendorId] = { record: recorded, history: [] }
    const reads = calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Reset Test scenario' }))
    const confirmation = await screen.findByRole('group', { name: 'Confirm Test scenario reset' })
    expect(confirmation.textContent).toContain('rereads the 1 Razorpay Test subscription it recorded')
    expect(calls.slice(reads).map((call) => call.operation)).toEqual(['status'])
  })

  it('keeps an unconfirmed reset pending with billing changes blocked and retries the same logical reset', async () => {
    const pending = {
      ...recorded, availableActions: [],
      reset: { state: 'pending', requestedAt: '2026-09-24T10:00:00.000Z', objects: [{ attemptId: 'lt_attempt1', associationId: 'sub_helper1', action: 'setup_autopay', outcome: 'cancel_acknowledged', providerStatus: 'authenticated' }] },
    }
    let replies = 0
    const calls = stubVendors({ [vendorId]: { record: recorded, history: [] } }, () => (++replies === 1 ? { record: pending, history: [] } : { record: null, history }))
    render(<VendorBillingLocalTest vendorId={vendorId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reset Test scenario' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm reset' }))
    expect(await screen.findByText(/Reset pending since/)).toBeTruthy()
    expect(screen.getByText('sub_helper1: Razorpay Test accepted the cancellation, but no read shows it closed yet.')).toBeTruthy()
    expect(await screen.findByText(/A Test scenario reset is pending/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pay Now' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel AutoPay' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Active trial' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Retry reset' }))
    expect(await screen.findByText(/Choose a scenario to start generation 2/)).toBeTruthy()
    const keys = calls.filter((call) => call.operation === 'resets').map((call) => call.body?.idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })

  it('keeps each vendor\'s scenario and reset history separate', async () => {
    stubVendors({ [vendorId]: { record: null, history }, 'vendor-2': { record: { ...recorded, vendorId: 'vendor-2' }, history: [] } }, () => { throw new Error('No reset expected') })
    const { rerender } = render(<VendorBillingLocalTest key={vendorId} vendorId={vendorId} />)
    expect(await screen.findByText(/Earlier Test scenarios for vendor vendor-1/)).toBeTruthy()
    rerender(<VendorBillingLocalTest key="vendor-2" vendorId="vendor-2" />)
    expect(await screen.findByText(/Scenario: Active trial · generation 1/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Earlier Test scenarios' })).toBeNull()
  })
})
