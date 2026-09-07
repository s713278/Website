import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('../mode', () => ({ isLiveApi: () => true }))

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
const { advanceVendorOrder, cancelVendorOrder, getVendorOrder, isOrderTransitionRefused } =
  await import('./vendor-orders.service')

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

beforeEach(() => {
  apiGet.mockReset()
  apiPatch.mockReset()
  apiPost.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('advanceVendorOrder', () => {
  it('rejects an HTTP 200 that moved nothing', async () => {
    apiPost.mockResolvedValue(refusal(1931))

    await expect(advanceVendorOrder(262, '1931', 'IN_PROCESS')).rejects.toSatisfy(
      isOrderTransitionRefused,
    )
  })

  it('does not repeat the backend reason, which is the same sentence for every refusal', async () => {
    apiPost.mockResolvedValue(refusal(1931))

    const error = await advanceVendorOrder(262, '1931', 'IN_PROCESS').catch(
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

    await expect(advanceVendorOrder(262, '1931', 'SHIPPED')).rejects.toSatisfy(
      isOrderTransitionRefused,
    )
  })

  it('resolves when the store reports the order actually moved', async () => {
    apiPost.mockResolvedValue({ data: { success_count: 1, failed_orders: [] } })

    await expect(advanceVendorOrder(262, '1931', 'SCHEDULED')).resolves.toBeUndefined()
  })

  it('posts one id in the shape the endpoint accepts', async () => {
    apiPost.mockResolvedValue({ data: { success_count: 1 } })

    await advanceVendorOrder(262, '1931', 'SCHEDULED')

    // `order_status` instead of `new_status` is a 400, and the ids are numbers.
    expect(apiPost).toHaveBeenCalledWith('/v1/vendors/262/orders/bulk-status-update', {
      order_ids: [1931],
      new_status: 'SCHEDULED',
    })
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
