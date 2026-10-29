import { beforeEach, describe, expect, it, vi } from 'vitest'

let live = true
const apiGet = vi.fn()
vi.mock('../mode', () => ({ isLiveApi: () => live }))
vi.mock('@mithra/api-client', async () => {
  const actual = await vi.importActual<typeof import('@mithra/api-client')>('@mithra/api-client')
  return { ...actual, apiGet: (...args: unknown[]) => apiGet(...args) }
})

const { listVendorSizes } = await import('./vendor-products.service')

beforeEach(() => {
  live = true
  apiGet.mockReset()
})

function page(number: number, ids: number[], last: boolean) {
  return { data: {
    result: ids.map((id) => ({
      sku_id: id, vendor_product_id: 42, price_id: id + 100,
      sku_name: 'Test Rice', sku_size: `${id} kg`, list_price: 100, sale_price: 90,
    })),
    page_number: number, last_page: last,
  } }
}

describe('listVendorSizes pagination', () => {
  it('includes prices on later pages even if the server returns fewer rows than requested', async () => {
    apiGet.mockResolvedValueOnce(page(0, [1, 2], false)).mockResolvedValueOnce(page(1, [3], true))

    const sizes = await listVendorSizes('vendor-42')

    expect(sizes.map(({ skuId, priceId }) => ({ skuId, priceId }))).toEqual([
      { skuId: '1', priceId: '101' }, { skuId: '2', priceId: '102' }, { skuId: '3', priceId: '103' },
    ])
    const urls = apiGet.mock.calls.map(([url]) => new URL(url, 'https://example.test'))
    expect(urls.map((url) => url.pathname)).toEqual([
      '/v1/vendors/vendor-42/products/skus', '/v1/vendors/vendor-42/products/skus',
    ])
    expect(urls.map((url) => url.searchParams.get('page_number'))).toEqual(['0', '1'])
    expect(urls.every((url) => Number(url.searchParams.get('page_size')) > 0)).toBe(true)
  })

  it('rejects a later-page failure instead of presenting an incomplete catalog as complete', async () => {
    apiGet.mockResolvedValueOnce(page(0, [1], false)).mockRejectedValueOnce(new Error('Network down'))
    await expect(listVendorSizes('vendor-42')).rejects.toThrow('Network down')
  })

  it('stops with an error if the backend keeps returning the first page', async () => {
    apiGet.mockResolvedValue(page(0, [1], false))
    await expect(listVendorSizes('vendor-42')).rejects.toThrow(/products/)
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  it('accepts an empty final page', async () => {
    apiGet.mockResolvedValue(page(0, [], true))
    await expect(listVendorSizes('vendor-42')).resolves.toEqual([])
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('stops paging when the Products view is abandoned', async () => {
    const controller = new AbortController()
    apiGet.mockImplementationOnce(async () => {
      controller.abort()
      return page(0, [1], false)
    })

    await expect(listVendorSizes('vendor-42', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet.mock.calls[0][1]).toEqual({ signal: controller.signal })
  })

  it('rejects missing pagination evidence instead of inventing a final page', async () => {
    apiGet.mockResolvedValue({ data: { result: [{ sku_id: 1 }] } })
    await expect(listVendorSizes('vendor-42')).rejects.toThrow(/products/)
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('keeps the complete demo catalog available without HTTP', async () => {
    live = false
    expect((await listVendorSizes('vendor-42')).length).toBeGreaterThan(0)
    expect(apiGet).not.toHaveBeenCalled()
  })
})
