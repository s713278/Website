import { getHttp, vendorsService as apiVendorsService } from '@mithra/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settleMeasurementDetails, vendorOnboardingService } from './vendor-onboarding.service'

let live = true

vi.mock('../mode', () => ({ isLiveApi: () => live }))

beforeEach(() => {
  live = true
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getVendorContext', () => {
  it('returns the mapped demo context without issuing a request', async () => {
    live = false
    const request = vi.spyOn(apiVendorsService, 'getContext').mockRejectedValue(
      new Error('Demo mode must not reach the backend.'),
    )

    await expect(vendorOnboardingService.getVendorContext('r1')).resolves.toMatchObject({
      vendorId: 'r1',
      vendorStatus: 'ACTIVE',
      approvalStatus: 'APPROVED',
      onboarding: { status: 'COMPLETED', nextStep: 11 },
      subscription: {
        tier: 'FREE',
        trialEndsAt: null,
      },
    })
    expect(request).not.toHaveBeenCalled()
  })
})

describe('createSkus', () => {
  it('sends a numeric quantity_value instead of the rejected price value field', async () => {
    const request = vi.spyOn(getHttp(), 'post').mockResolvedValue({ data: { success: true } })

    await vendorOnboardingService.createSkus('91', {
      active: true,
      homeDelivery: false,
      storePickup: true,
      sizes: [{
        measurementType: 'VOLUME',
        unit: 'L',
        quantity: 0.5,
        listPrice: 60,
        salePrice: 55,
      }],
    }, 900)

    expect(request).toHaveBeenCalledWith('/v1/vendors/91/skus', {
      product_id: 900,
      sku_type: 'ITEM',
      is_active: true,
      home_delivery: false,
      store_pickup: true,
      subscription_eligible: false,
      eligible_sub_plans: [],
      price_list: [{
        measurement_type: 'VOLUME',
        unit: 'L',
        quantity_value: 0.5,
        effective_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        list_price: 60,
        sale_price: 55,
        shipping_price: 0,
      }],
    }, expect.anything())
  })
})

describe('SKU edits', () => {
  it('patches quantity and unit together without overwriting product details or features', async () => {
    const request = vi.spyOn(getHttp(), 'patch').mockResolvedValue({ data: { success: true } })

    await vendorOnboardingService.updateSku('91', 4021, { quantity: 0.5, unit: 'L', active: false })

    expect(request).toHaveBeenCalledWith('/v1/vendors/91/skus/4021', {
      quantity_value: 0.5, unit: 'L', is_active: false,
    }, expect.anything())
  })

  it('updates prices using the price record id and includes the SKU id in the body', async () => {
    const request = vi.spyOn(getHttp(), 'put').mockResolvedValue({ data: { success: true } })

    await vendorOnboardingService.updateSkuPrice(4021, 8021, { listPrice: 60, salePrice: 50 })

    expect(request).toHaveBeenCalledWith('/v1/sku/price/8021', {
      sku_id: 4021, list_price: 60, sale_price: 50,
    }, expect.anything())
  })
})

describe('SKU account reads', () => {
  const sku = (id: number) => ({
    vendor_product_id: 900, sku_id: id, price_id: id + 100,
    sku_name: 'Milk', quantity_value: id, unit: 'L', list_price: 60, sale_price: 55,
  })
  const page = (number: number, ids: number[], last: boolean) => ({ data: {
    result: ids.map(sku), page_number: number, last_page: last,
  } })

  it('loads every page before reconciling saved sizes', async () => {
    const request = vi.spyOn(apiVendorsService, 'getProductSkus')
      .mockResolvedValueOnce(page(0, [1], false))
      .mockResolvedValueOnce(page(1, [2], true))

    expect((await vendorOnboardingService.getVendorSkus('91')).map((size) => size.skuId)).toEqual([1, 2])
    expect(request.mock.calls.map(([, config]) => config?.params?.page_number)).toEqual([0, 1])
  })

  it('rejects a failed later page instead of reconciling an incomplete account', async () => {
    vi.spyOn(apiVendorsService, 'getProductSkus')
      .mockResolvedValueOnce(page(0, [1], false))
      .mockRejectedValueOnce(new Error('Read failed'))
    await expect(vendorOnboardingService.getVendorSkus('91')).rejects.toThrow('Read failed')
  })

  it('rejects repeated pages and missing pagination evidence', async () => {
    const request = vi.spyOn(apiVendorsService, 'getProductSkus').mockResolvedValue(page(0, [1], false))
    await expect(vendorOnboardingService.getVendorSkus('91')).rejects.toThrow(/sizes/i)
    expect(request).toHaveBeenCalledTimes(2)

    request.mockResolvedValue({ data: { result: [sku(1)] } })
    await expect(vendorOnboardingService.getVendorSkus('91')).rejects.toThrow(/sizes/i)
  })

  it('still accepts a complete legacy array response', async () => {
    const request = vi.spyOn(apiVendorsService, 'getProductSkus').mockResolvedValue({ data: [sku(1)] })
    expect(await vendorOnboardingService.getVendorSkus('91')).toHaveLength(1)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('stops before requesting the next page after cancellation', async () => {
    const controller = new AbortController()
    const request = vi.spyOn(apiVendorsService, 'getProductSkus').mockImplementation(async () => {
      controller.abort()
      return page(0, [1], false)
    })
    await expect(vendorOnboardingService.getVendorSkus('91', { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('measurement detail requests', () => {
  it('keeps fulfilled detail payloads when another detail request fails', async () => {
    const area = { data: { id: 4, type: 'AREA', unit_options: [50, 100] } }
    const volume = { data: { id: 2, type: 'VOLUME', unit_options: [0.5, 1] } }

    await expect(settleMeasurementDetails([
      Promise.resolve(area),
      Promise.reject(new Error('one detail is unavailable')),
      Promise.resolve(volume),
    ])).resolves.toEqual([area, volume])
  })

  it('preserves cancellation rather than treating it as a recoverable row failure', async () => {
    const controller = new AbortController()
    const reason = new Error('catalog request cancelled')
    controller.abort(reason)

    await expect(settleMeasurementDetails(
      [Promise.reject(reason)],
      controller.signal,
    )).rejects.toBe(reason)
  })
})
