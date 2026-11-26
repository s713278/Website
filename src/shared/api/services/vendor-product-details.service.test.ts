import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiErrorFromResponse, getHttp } from '@mithra/api-client'
import { resetDemoState } from '../fixtures/demo-state'
import { vendorProductsService } from './vendor-products.service'

let live = true
vi.mock('../mode', () => ({ isLiveApi: () => live }))
beforeEach(() => { live = true })
afterEach(() => vi.restoreAllMocks())

function details(data: Record<string, unknown>) {
  return { data: { success: true, data: { product_id: 42, ref_id: 7, name: 'Toned Milk', ...data } } }
}

describe('vendor product details read', () => {
  it('reads by vendor product id and keeps map-shaped features in key order', async () => {
    const get = vi.spyOn(getHttp(), 'get').mockResolvedValue(details({
      description: 'Fresh every morning.',
      features_type: 'map',
      features_map: { Brand: 'Nandini', 'Made in': 'Karnataka' },
    }))
    const controller = new AbortController()

    await expect(vendorProductsService.getProductDetails('91', '42', { signal: controller.signal })).resolves.toEqual({
      description: 'Fresh every morning.',
      features: [
        { label: 'Brand', detail: 'Nandini' },
        { label: 'Made in', detail: 'Karnataka' },
      ],
    })
    expect(get).toHaveBeenCalledWith('/v1/vendors/91/products/42', expect.objectContaining({ signal: controller.signal }))
  })

  it('turns list-shaped features into rows with no label', async () => {
    vi.spyOn(getHttp(), 'get').mockResolvedValue(details({
      description: null,
      features_type: 'list',
      features_list: ['Unpolished', 'Certified organic'],
      features_map: {},
    }))
    await expect(vendorProductsService.getProductDetails('91', '42')).resolves.toEqual({
      description: '',
      features: [{ label: '', detail: 'Unpolished' }, { label: '', detail: 'Certified organic' }],
    })
  })

  it('reads missing features as none', async () => {
    vi.spyOn(getHttp(), 'get').mockResolvedValue(details({ description: 'Plain.' }))
    await expect(vendorProductsService.getProductDetails('91', '42')).resolves.toEqual({ description: 'Plain.', features: [] })
  })

  it('passes on a backend error normalized', async () => {
    vi.spyOn(getHttp(), 'get').mockRejectedValue(apiErrorFromResponse(404, { success: false, user_message: 'Product not found' }))
    await expect(vendorProductsService.getProductDetails('91', '42')).rejects.toMatchObject({ status: 404 })
  })
})

describe('vendor product details save', () => {
  function patchSpy() {
    return vi.spyOn(getHttp(), 'patch').mockResolvedValue({ data: { success: true, data: null } })
  }

  it('sends only the description when only the description is given', async () => {
    const patch = patchSpy()
    await vendorProductsService.updateProductDetails('91', '42', { description: 'New words.' })
    expect(patch.mock.calls.map(([path, body]) => [path, body])).toEqual([['/v1/vendors/91/products/42', { description: 'New words.' }]])
  })

  it('sends a blank description as a blank string', async () => {
    const patch = patchSpy()
    await vendorProductsService.updateProductDetails('91', '42', { description: '' })
    expect(patch.mock.calls[0][1]).toEqual({ description: '' })
  })

  it('sends features as an object in row order, and no rows as {}', async () => {
    const patch = patchSpy()
    await vendorProductsService.updateProductDetails('91', '42', {
      features: [{ label: 'Made in', detail: 'Karnataka' }, { label: 'Brand', detail: 'Nandini' }],
    })
    await vendorProductsService.updateProductDetails('91', '42', { features: [] })
    const [sent, cleared] = patch.mock.calls.map(([, body]) => body)
    expect(sent).toEqual({ features: { 'Made in': 'Karnataka', Brand: 'Nandini' } })
    expect(Object.keys((sent as { features: object }).features)).toEqual(['Made in', 'Brand'])
    expect(cleared).toEqual({ features: {} })
  })

  it('passes on a refused save normalized', async () => {
    vi.spyOn(getHttp(), 'patch').mockRejectedValue(apiErrorFromResponse(400, { success: false, user_message: 'Features are too large' }))
    await expect(vendorProductsService.updateProductDetails('91', '42', { description: 'x' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('vendor product details in demo mode', () => {
  beforeEach(() => {
    live = false
    resetDemoState()
  })

  it('saves and reads back off the network, and a reset falls back to the catalog default', async () => {
    const get = vi.spyOn(getHttp(), 'get').mockRejectedValue(new Error('Unexpected request'))
    const patch = vi.spyOn(getHttp(), 'patch').mockRejectedValue(new Error('Unexpected request'))
    const before = await vendorProductsService.getProductDetails('demo', '201')

    await vendorProductsService.updateProductDetails('demo', '201', {
      description: 'Our own tomatoes.',
      features: [{ label: 'Brand', detail: 'Farm fresh' }],
    })
    await expect(vendorProductsService.getProductDetails('demo', '201')).resolves.toEqual({
      description: 'Our own tomatoes.',
      features: [{ label: 'Brand', detail: 'Farm fresh' }],
    })

    await vendorProductsService.updateProductDetails('demo', '201', { description: '', features: [] })
    await expect(vendorProductsService.getProductDetails('demo', '201')).resolves.toEqual(before)
    expect(get).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
  })
})
