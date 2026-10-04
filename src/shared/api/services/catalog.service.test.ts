import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../mode', () => ({ isLiveApi: vi.fn(() => true) }))

const getProduct = vi.fn()

vi.mock('@mithra/api-client', async () => {
  const actual = await vi.importActual<typeof import('@mithra/api-client')>('@mithra/api-client')
  return {
    ...actual,
    storefrontService: {
      ...actual.storefrontService,
      getProduct: (...args: unknown[]) => getProduct(...args),
    },
  }
})

const { ApiError } = await import('@mithra/api-client')
const { isLiveApi } = await import('../mode')
const { getStorefrontProduct } = await import('./catalog.service')

beforeEach(() => {
  vi.mocked(isLiveApi).mockReturnValue(true)
  getProduct.mockReset()
})

describe('getStorefrontProduct', () => {
  it('loads one product from the storefront product path', async () => {
    getProduct.mockResolvedValue({
      success: true,
      data: {
        vendor_product_id: 418,
        product_name: 'Amla Pickle',
        active: true,
        default_sku_id: 4153,
        variants_count: 2,
        min_sale_price: 245,
        max_sale_price: 450,
        starting_at: 245,
        variants: [
          { sku_id: 4153, quantity_value: 500, unit: 'gr', sale_price: 245, active: true },
          { sku_id: 4152, quantity_value: 1, unit: 'KG', sale_price: 450, active: true },
        ],
      },
    })

    const product = await getStorefrontProduct('273', '418')

    expect(getProduct).toHaveBeenCalledTimes(1)
    expect(getProduct).toHaveBeenCalledWith('273', '418')
    expect(product?.defaultVariantId).toBe('4153')
    expect(product?.variants?.map((variant) => variant.unit)).toEqual(['500 gr', '1 KG'])
  })

  it('shares one request when the page load starts twice', async () => {
    let release: (value: unknown) => void = () => undefined
    getProduct.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )

    const first = getStorefrontProduct('273', '418')
    const second = getStorefrontProduct('273', '418')
    release({
      success: true,
      data: {
        vendor_product_id: 418,
        product_name: 'Amla Pickle',
        active: true,
        default_sku_id: 4153,
        variants: [{ sku_id: 4153, quantity_value: 500, unit: 'gr', sale_price: 245, active: true }],
      },
    })

    const [a, b] = await Promise.all([first, second])
    expect(getProduct).toHaveBeenCalledTimes(1)
    expect(a?.id).toBe('418')
    expect(b?.id).toBe(a?.id)
  })

  it('treats 404 as an unavailable product', async () => {
    getProduct.mockRejectedValue(
      new ApiError('Not found', 404, {}, '/v1/vendors/273/storefront/products/418', 'not_found'),
    )

    await expect(getStorefrontProduct('273', '418')).resolves.toBeNull()
    expect(getProduct).toHaveBeenCalledTimes(1)
  })

  it('does not retry an invalid API key', async () => {
    getProduct.mockRejectedValue(
      new ApiError('Unauthorized', 401, {}, '/v1/vendors/273/storefront/products/418', 'unauthorized'),
    )

    await expect(getStorefrontProduct('273', '418')).rejects.toMatchObject({ status: 401 })
    expect(getProduct).toHaveBeenCalledTimes(1)
  })
})
