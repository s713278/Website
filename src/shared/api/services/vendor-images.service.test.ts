import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiErrorFromResponse, getHttp } from '@mithra/api-client'
import { vendorImagesService } from './vendor-images.service'

let live = true
vi.mock('../mode', () => ({ isLiveApi: () => live }))
beforeEach(() => { live = true })
afterEach(() => vi.restoreAllMocks())

describe('vendor image contract', () => {
  it('keeps a 404 as a failed read while a sibling image can succeed independently', async () => {
    vi.spyOn(getHttp(), 'get').mockImplementation(async (_path, config) => {
      const params = config?.params
      if (params && typeof params === 'object' && 'image_type' in params && params.image_type === 'THUMBNAIL') {
        throw apiErrorFromResponse(404, { success: false, failure_reason: 'Vendor not found' })
      }
      return { data: { success: true, data: { image_url: 'https://images.example.test/banner.png' } } }
    })
    await expect(vendorImagesService.getImage('91', 'logo')).rejects.toMatchObject({ status: 404 })
    await expect(vendorImagesService.getImage('91', 'banner')).resolves.toBe('https://images.example.test/banner.png')
  })
  it('keeps demo reads and uploads off the network', async () => {
    live = false
    const get = vi.spyOn(getHttp(), 'get').mockRejectedValue(new Error('Unexpected request'))
    const post = vi.spyOn(getHttp(), 'post').mockRejectedValue(new Error('Unexpected request'))
    await expect(vendorImagesService.getImage('demo', 'logo')).resolves.toBeNull()
    await expect(vendorImagesService.getImage('demo', 'banner')).resolves.toBeNull()
    await expect(vendorImagesService.uploadImage('demo', 'logo', new File(['png'], 'logo.png', { type: 'image/png' }))).rejects.toThrow('Demo images')
    expect(get).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('reads both image types with query parameters and preserves an absent image', async () => {
    const get = vi.spyOn(getHttp(), 'get').mockImplementation(async (_path, config) => ({
      data: { success: true, data: { image_url: config?.params && typeof config.params === 'object' && 'image_type' in config.params && config.params.image_type === 'THUMBNAIL' ? 'https://images.example.test/logo.png' : null } },
    }))
    const controller = new AbortController()
    await expect(vendorImagesService.getImage('91', 'logo', { signal: controller.signal })).resolves.toBe('https://images.example.test/logo.png')
    await expect(vendorImagesService.getImage('91', 'banner', { signal: controller.signal })).resolves.toBeNull()
    expect(get.mock.calls.map(([path, config]) => [path, config?.params, config?.signal])).toEqual([
      ['/v1/vendors/91/images', { image_type: 'THUMBNAIL' }, controller.signal],
      ['/v1/vendors/91/images', { image_type: 'HOMEBANNER' }, controller.signal],
    ])
  })

  it('uploads the original file in multipart and image_type in the query', async () => {
    const post = vi.spyOn(getHttp(), 'post').mockResolvedValue({ data: {
      success: true, data: { image_url: 'https://images.example.test/banner.gif' },
    } })
    const file = new File(['gif'], 'banner.gif', { type: 'image/gif' })
    const controller = new AbortController()
    await expect(vendorImagesService.uploadImage('91', 'banner', file, { signal: controller.signal }))
      .resolves.toBe('https://images.example.test/banner.gif')
    const [path, body, config] = post.mock.calls[0]
    expect(path).toBe('/v1/vendors/91/images')
    expect(body).toBeInstanceOf(FormData)
    if (!(body instanceof FormData)) throw new Error('Expected multipart body')
    expect(body.get('file')).toBe(file)
    expect([...body.keys()]).toEqual(['file'])
    expect(config).toMatchObject({ params: { image_type: 'HOMEBANNER' }, signal: controller.signal })
  })

  it.each([{}, { image_url: 'blob:local' }, { image_url: 123 }])('rejects unreadable responses rather than clearing a saved image: %j', async (data) => {
    vi.spyOn(getHttp(), 'get').mockResolvedValue({ data: { success: true, data } })
    await expect(vendorImagesService.getImage('91', 'logo')).rejects.toThrow('Could not read the saved image')
  })

  it('does not report an upload as saved without a returned URL', async () => {
    vi.spyOn(getHttp(), 'post').mockResolvedValue({ data: { success: true, data: { image_url: null } } })
    await expect(vendorImagesService.uploadImage('91', 'logo', new File(['png'], 'logo.png', { type: 'image/png' })))
      .rejects.toThrow('did not return an image URL')
  })

  it('rejects a success:false response even over HTTP 200', async () => {
    vi.spyOn(getHttp(), 'post').mockResolvedValue({ data: { success: false, message: 'Upload refused' } })
    await expect(vendorImagesService.uploadImage('91', 'logo', new File(['png'], 'logo.png', { type: 'image/png' })))
      .rejects.toThrow()
  })
})
