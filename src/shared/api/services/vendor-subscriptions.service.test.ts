import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let live = true
const apiGet = vi.fn()

vi.mock('../mode', () => ({ isLiveApi: () => live }))

vi.mock('@mithra/api-client', async () => {
  const actual = await vi.importActual<typeof import('@mithra/api-client')>('@mithra/api-client')
  return { ...actual, apiGet: (...args: unknown[]) => apiGet(...args) }
})

const { listVendorSubscriptions } = await import('./vendor-subscriptions.service')

beforeEach(() => {
  live = true
  apiGet.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('listVendorSubscriptions', () => {
  it('returns every demo status through the same mapped page without a request', async () => {
    live = false

    const page = await listVendorSubscriptions('vendor-1')

    expect(new Set(page.subscriptions.map((subscription) => subscription.status))).toEqual(
      new Set(['PENDING', 'ACTIVE', 'DELETED', 'EXPIRED']),
    )
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('uses the endpoint paging names and the signed-in vendor id supplied by its caller', async () => {
    apiGet.mockResolvedValue({
      data: {
        result: [],
        page_number: 2,
        page_size: 10,
        total_elements: 0,
        total_pages: 0,
        last_page: true,
      },
    })

    await listVendorSubscriptions('vendor-42', { page: 2, status: 'DELETED' })

    expect(apiGet).toHaveBeenCalledWith(
      '/v1/vendors/vendor-42/subs?page_number=2&page_size=10&status=DELETED',
    )
  })

})
