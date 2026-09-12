import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeliveryStatus } from '@/modules/vendor/types/dashboard'
import { resetDemoState } from '../fixtures/demo-state'
import { isLiveApi } from '../mode'

/**
 * The refusal path, which is the point of this service.
 *
 * `POST /v1/vendors/{v}/orders/bulk-status-update` answers an illegal transition with
 * **HTTP 200**, `success: true`, and `success_count: 0`. Nothing in the transport layer can
 * see that as a failure — `assertApiSuccess` passes, no interceptor fires — so if this
 * service does not inspect the body, the advance button reports a silent no-op as a success.
 * That was the live behaviour before this file existed.
 *
 * The mode is forced live because the demo branch never issues a request, and the API
 * package is mocked because `.env` here carries `VITE_USE_API=true`: an escaped seam would
 * hit the shared dev backend for real.
 */

vi.mock('../mode', () => ({ isLiveApi: vi.fn(() => true) }))

vi.mock('@mithra/api-client', async () => {
  const actual = await vi.importActual<typeof import('@mithra/api-client')>('@mithra/api-client')
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGet(...args),
    apiPatch: (...args: unknown[]) => apiPatch(...args),
    apiPost: (...args: unknown[]) => apiPost(...args),
  }
})

const apiGet = vi.fn()
const apiPatch = vi.fn()
const apiPost = vi.fn()

const { ApiError } = await import('@mithra/api-client')
const {
  advanceVendorOrder,
  cancelVendorOrder,
  getVendorOrder,
  isOrderTransitionRefused,
  listVendorOrders,
  setVendorOrderPaymentStatus,
} = await import('./vendor-orders.service')
const { readPaidOrders, recordPaidOrder } = await import('./paid-orders-store')

/** The exact envelope the deployed API returns for a refused transition. */
function refusal(orderId: number) {
  return {
    timestamp: '2026-09-06T10:00:00Z',
    success: true,
    status: 200,
    data: {
      success_count: 0,
      failed_orders: [{ order_id: orderId, reason: 'Please check the input request and try again.' }],
    },
  }
}

/**
 * A Map-backed `localStorage`, because the payment record is a browser store and these
 * suites run in the node environment. Rebuilt per test so no record leaks between them.
 */
function stubStorage() {
  const entries = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  }
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('window', { localStorage })
  return entries
}

let browserStorage: Map<string, string>

beforeEach(() => {
  vi.mocked(isLiveApi).mockReturnValue(true)
  resetDemoState()
  browserStorage = stubStorage()
  apiGet.mockReset()
  apiPatch.mockReset()
  apiPost.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('advanceVendorOrder', () => {
  it('rejects an HTTP 200 that moved nothing', async () => {
    apiPost.mockResolvedValue(refusal(1931))

    await expect(advanceVendorOrder(262, '1931', 'SCHEDULED', 'IN_PROCESS')).rejects.toSatisfy(
      isOrderTransitionRefused,
    )
  })

  it('does not repeat the backend reason, which is the same sentence for every refusal', async () => {
    apiPost.mockResolvedValue(refusal(1931))

    const error = await advanceVendorOrder(262, '1931', 'SCHEDULED', 'IN_PROCESS').catch(
      (thrown: unknown) => thrown,
    )

    expect(isOrderTransitionRefused(error)).toBe(true)
    expect((error as Error).message).not.toContain('Please check the input request')
    // Carried for logs, deliberately not for display.
    expect((error as { backendReason: string | null }).backendReason).toBe(
      'Please check the input request and try again.',
    )
  })

  it('rejects a response it cannot read rather than assuming the write landed', async () => {
    apiPost.mockResolvedValue({ data: {} })

    await expect(advanceVendorOrder(262, '1931', 'IN_PROCESS', 'SHIPPED')).rejects.toSatisfy(
      isOrderTransitionRefused,
    )
  })

  it('resolves when the store reports the order actually moved', async () => {
    apiPost.mockResolvedValue({ data: { success_count: 1, failed_orders: [] } })

    await expect(advanceVendorOrder(262, '1931', 'SCHEDULED', 'IN_PROCESS')).resolves.toBeUndefined()
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(apiPost).toHaveBeenCalledWith('/v1/vendors/262/orders/bulk-status-update', {
      order_ids: [1931], new_status: 'IN_PROCESS',
    })
  })

  it('posts one id in the shape the endpoint accepts', async () => {
    apiPost.mockResolvedValue({ data: { success_count: 1 } })

    await advanceVendorOrder(262, '1931', 'PENDING', 'SCHEDULED')

    // `order_status` instead of `new_status` is a 400, and the ids are numbers.
    expect(apiPost).toHaveBeenCalledWith('/v1/vendors/262/orders/bulk-status-update', {
      order_ids: [1931],
      new_status: 'SCHEDULED',
    })
  })

  it('waits for each hop before confirming a legacy new order', async () => {
    let finishFirst!: (value: unknown) => void
    apiPost.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve }))
      .mockResolvedValueOnce({ data: { success_count: 1 } })

    const advancing = advanceVendorOrder(262, '1931', 'PENDING', 'IN_PROCESS')
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(apiPost.mock.calls[0][1]).toEqual({ order_ids: [1931], new_status: 'SCHEDULED' })
    finishFirst({ data: { success_count: 1 } })
    await advancing
    expect(apiPost).toHaveBeenCalledTimes(2)
    expect(apiPost.mock.calls[1][1]).toEqual({ order_ids: [1931], new_status: 'IN_PROCESS' })
  })

  it('stops after a refusal on the first hop', async () => {
    apiPost.mockResolvedValue(refusal(1931))
    await expect(advanceVendorOrder(262, '1931', 'PENDING', 'IN_PROCESS')).rejects.toSatisfy(
      isOrderTransitionRefused,
    )
    expect(apiPost).toHaveBeenCalledTimes(1)
  })

  it.each(['refusal', 'transport'])('carries partial progress after a second-hop %s failure', async (failure) => {
    apiPost.mockResolvedValueOnce({ data: { success_count: 1 } })
    if (failure === 'refusal') apiPost.mockResolvedValueOnce(refusal(1931))
    else apiPost.mockRejectedValueOnce(new Error('Network down'))

    await expect(advanceVendorOrder(262, '1931', 'PENDING', 'IN_PROCESS')).rejects.toMatchObject({
      reachedStatus: 'SCHEDULED',
      requestedStatus: 'IN_PROCESS',
    })
    expect(apiPost).toHaveBeenCalledTimes(2)
  })

})

describe('advanceVendorOrder in demo mode', () => {
  beforeEach(() => {
    vi.mocked(isLiveApi).mockReturnValue(false)
    vi.useFakeTimers()
  })

  it('visits the intermediate state and remains pending until both hops finish', async () => {
    let finished = false
    const advancing = advanceVendorOrder(262, '4021', 'PENDING', 'IN_PROCESS').then(() => {
      finished = true
    })
    const intermediate = getVendorOrder(262, '4021')
    await vi.advanceTimersByTimeAsync(150)
    expect((await intermediate)?.deliveryStatus).toBe('SCHEDULED')
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(150)
    await advancing
    const final = getVendorOrder(262, '4021')
    await vi.runAllTimersAsync()
    expect((await final)?.deliveryStatus).toBe('IN_PROCESS')
    expect(apiPost).not.toHaveBeenCalled()
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('confirms an ordinary new order in one hop', async () => {
    const advancing = advanceVendorOrder(262, '4020', 'SCHEDULED', 'IN_PROCESS')
    await vi.advanceTimersByTimeAsync(150)
    await advancing
    const final = getVendorOrder(262, '4020')
    await vi.runAllTimersAsync()
    expect((await final)?.deliveryStatus).toBe('IN_PROCESS')
  })
})

describe.each([true, false])('advanceVendorOrder with live mode %s', (live) => {
  beforeEach(() => {
    vi.mocked(isLiveApi).mockReturnValue(live)
    vi.useFakeTimers()
  })

  it('refuses a hop that skips the actual order state, even when the caller is stale', async () => {
    apiPost.mockResolvedValue(refusal(4021))
    // This fixture is PENDING. A caller claiming IN_PROCESS must not bypass the actual
    // order's one-hop rule, which the live endpoint enforces against its own stored state.
    const rejected = expect(
      advanceVendorOrder(262, '4021', 'IN_PROCESS', 'SHIPPED'),
    ).rejects.toSatisfy(isOrderTransitionRefused)
    await vi.runAllTimersAsync()
    await rejected
    if (live) expect(apiPost).toHaveBeenCalledTimes(1)
    else {
      const unchanged = getVendorOrder(262, '4021')
      await vi.runAllTimersAsync()
      expect((await unchanged)?.deliveryStatus).toBe('PENDING')
      expect(apiPost).not.toHaveBeenCalled()
    }
  })

  it.each<DeliveryStatus>(['PENDING', 'CANCELLED'])('refuses destination %s before any write', async (target) => {
    const rejected = expect(
      advanceVendorOrder(262, '4021', 'PENDING', target),
    ).rejects.toSatisfy(isOrderTransitionRefused)
    await vi.runAllTimersAsync()
    await rejected
    expect(apiPost).not.toHaveBeenCalled()
  })
})

describe('cancelVendorOrder', () => {
  it('uses its own endpoint and camelCase key, never the bulk one', async () => {
    // `CANCELLED` is in the bulk endpoint's declared enum but returns 417 with a rolled-back
    // transaction, and `cancel_reason` in snake_case is a 400. Both spellings have burned
    // someone already.
    apiPatch.mockResolvedValue({ data: 'Order cancelled successfully.' })

    await cancelVendorOrder(262, '1931', 'Out of stock')

    expect(apiPatch).toHaveBeenCalledWith('/v1/vendors/262/orders/1931/cancel', {
      cancelReason: 'Out of stock',
    })
    expect(apiPost).not.toHaveBeenCalled()
  })
})

describe('getVendorOrder', () => {
  it('reports a missing order as absent, not as a failure', async () => {
    // The screen says different things for the two, and only one is worth a retry.
    apiGet.mockRejectedValue(new ApiError('Not found', 404, {}, '/items', 'not_found'))

    await expect(getVendorOrder(262, '999999')).resolves.toBeNull()
  })

  it('still throws when the request itself failed', async () => {
    apiGet.mockRejectedValue(new ApiError('Server error', 500, {}, '/items', 'server'))

    await expect(getVendorOrder(262, '1931')).rejects.toBeInstanceOf(ApiError)
  })
})

/**
 * The vendor's own payment record.
 *
 * No backend route can store one — both `PATCH` routes carrying `payment_status` return
 * 417 for every body, and `PATCH /v1/users/{u}/orders/{o}` answers a payment write with a
 * false `200` and changes nothing. So the record lives on the device, layered over the
 * backend's read here in the service, and the screens never learn where it is kept. See
 * `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`.
 */

/** One list row in the 15-key shape the deployed endpoint returns. */
function row(orderId: string, paymentStatus: string | null, orderStatus = 'DELIVERED') {
  return {
    order_id: orderId,
    order_status: orderStatus,
    payment_status: paymentStatus,
    amount: 320,
    mobile: '9000000001',
    delivery_date: '2026-09-09',
  }
}

function listPage(rows: ReturnType<typeof row>[]) {
  return { data: { result: rows, page_number: 0, total_pages: 1, total_elements: rows.length } }
}

describe('the payment record on a live read', () => {
  it('shows an order this vendor marked paid, though the store still calls it due', async () => {
    recordPaidOrder('262', '1931', true)
    apiGet.mockResolvedValue(listPage([row('1931', 'DUE')]))

    const page = await listVendorOrders(262, {})

    expect(page.orders[0].paymentStatus).toBe('PAID')
  })

  it('carries the same record onto order detail', async () => {
    recordPaidOrder('262', '1931', true)
    apiGet.mockResolvedValue({ data: row('1931', 'DUE') })

    expect((await getVendorOrder(262, '1931'))?.paymentStatus).toBe('PAID')
  })

  it('keeps one vendor account on a shared device out of another one', async () => {
    recordPaidOrder('262', '1931', true)
    apiGet.mockResolvedValue(listPage([row('1931', 'DUE')]))

    const page = await listVendorOrders(999, {})

    expect(page.orders[0].paymentStatus).toBe('DUE')
  })

  it('leaves an unknown payment status unknown, rather than calling it due', async () => {
    // `null` is what the mapper yields when the backend omitted the field. Collapsing it
    // into DUE would state something the store never said.
    apiGet.mockResolvedValue(listPage([row('1931', null)]))

    expect((await listVendorOrders(262, {})).orders[0].paymentStatus).toBeNull()
  })

  it('applies the record to an order whose payment status the store omitted', async () => {
    recordPaidOrder('262', '1931', true)
    apiGet.mockResolvedValue(listPage([row('1931', null)]))

    expect((await listVendorOrders(262, {})).orders[0].paymentStatus).toBe('PAID')
  })

  it('lets a backend PAID win, and drops the note it makes redundant', async () => {
    // Nothing can produce a backend PAID today. This is what makes the store self-emptying
    // if that ever changes, rather than two records fighting.
    recordPaidOrder('262', '1931', true)
    apiGet.mockResolvedValue(listPage([row('1931', 'PAID')]))

    const page = await listVendorOrders(262, {})

    expect(page.orders[0].paymentStatus).toBe('PAID')
    expect([...readPaidOrders('262')]).toEqual([])
  })

  it('stops applying a record the vendor reversed', async () => {
    recordPaidOrder('262', '1931', true)
    recordPaidOrder('262', '1931', false)
    apiGet.mockResolvedValue(listPage([row('1931', 'DUE')]))

    expect((await listVendorOrders(262, {})).orders[0].paymentStatus).toBe('DUE')
  })
})

describe('setVendorOrderPaymentStatus', () => {
  it('records a payment without asking the backend to, because nothing there can', async () => {
    await setVendorOrderPaymentStatus(262, '1931', 'PAID')

    expect([...readPaidOrders('262')]).toEqual(['1931'])
    // `PATCH /v1/users/{u}/orders/{o}` answers a payment write with a false 200 and a
    // success message. A client that trusted it would toast over an unpaid order.
    expect(apiPatch).not.toHaveBeenCalled()
    expect(apiPost).not.toHaveBeenCalled()
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('reverses one', async () => {
    await setVendorOrderPaymentStatus(262, '1931', 'PAID')
    await setVendorOrderPaymentStatus(262, '1931', 'DUE')

    expect([...readPaidOrders('262')]).toEqual([])
  })
})

describe('setVendorOrderPaymentStatus in demo mode', () => {
  beforeEach(() => {
    vi.mocked(isLiveApi).mockReturnValue(false)
    vi.useFakeTimers()
  })

  it('writes the demo order and leaves the browser alone, so a reload resets it', async () => {
    const marking = setVendorOrderPaymentStatus(262, '4009', 'PAID')
    await vi.runAllTimersAsync()
    await marking

    const marked = getVendorOrder(262, '4009')
    await vi.runAllTimersAsync()
    expect((await marked)?.paymentStatus).toBe('PAID')
    // Demo flags must never land in a real vendor's storage, and demo's reset-on-reload
    // contract is what makes a walkthrough repeatable.
    expect(browserStorage.size).toBe(0)

    resetDemoState()
    const afterReload = getVendorOrder(262, '4009')
    await vi.runAllTimersAsync()
    expect((await afterReload)?.paymentStatus).toBe('DUE')
  })

  it('says so when there is no such demo order', async () => {
    const rejected = expect(setVendorOrderPaymentStatus(262, '9999', 'PAID')).rejects.toThrow()
    await vi.runAllTimersAsync()
    await rejected
  })
})
