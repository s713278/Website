import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vendorImagesService, vendorOnboardingService } from '@/shared/api'
import { createEmptyOnboardingDraft, createEmptyRuntimeState } from '../data/onboarding-defaults'
import { useOnboardingStore } from '../store/onboarding-store'
import { imageSelectionError, MAX_VENDOR_IMAGE_BYTES, savePendingImages } from './onboarding-images'
import { persistStep } from './onboarding-sync'

beforeEach(() => useOnboardingStore.getState().abandonDraft())
afterEach(() => {
  useOnboardingStore.getState().abandonDraft()
  vi.restoreAllMocks()
})

describe('image selection', () => {
  it.each(['image/png', 'image/jpeg', 'image/gif'])('accepts %s through exactly 5 MB, with no dimension rule', (type) => {
    expect(imageSelectionError({ type, size: MAX_VENDOR_IMAGE_BYTES })).toBeNull()
    expect(imageSelectionError({ type, size: MAX_VENDOR_IMAGE_BYTES + 1 })).toContain('5 MB')
  })
  it.each(['image/webp', 'image/heic', '', 'text/plain'])('rejects %s with the allowed types', (type) => {
    expect(imageSelectionError({ type, size: 10 })).toContain('PNG, JPEG, or GIF')
  })
  it('restores saved images without replacing a pending selection, and discards only that selection', () => {
    const store = useOnboardingStore.getState()
    const file = new File(['png'], 'local.png', { type: 'image/png' })
    store.setImage('logo', file, 'blob:pending')
    store.restoreImage('logo', 'https://images.example.test/saved.png')
    expect(useOnboardingStore.getState().runtime.logoUrl).toBe('blob:pending')
    store.setImage('logo', null, null)
    expect(useOnboardingStore.getState().runtime).toMatchObject({
      logoFile: null, logoUrl: 'https://images.example.test/saved.png', savedLogoUrl: 'https://images.example.test/saved.png',
    })
  })
})

describe('upload on Continue', () => {
  it('retains a successful sibling and retries only the failed upload before saving server URLs', async () => {
    const logo = new File(['png'], 'logo.png', { type: 'image/png' })
    const banner = new File(['gif'], 'banner.gif', { type: 'image/gif' })
    const store = useOnboardingStore.getState()
    store.setImage('logo', logo, 'blob:logo')
    store.setImage('banner', banner, 'blob:banner')
    const upload = vi.spyOn(vendorImagesService, 'uploadImage')
      .mockResolvedValueOnce('https://images.example.test/logo.png')
      .mockRejectedValueOnce(new Error('Please retry the banner'))
      .mockResolvedValueOnce('https://images.example.test/banner.gif')
    const save = vi.spyOn(vendorOnboardingService, 'saveStorefront').mockResolvedValue(undefined)
    const draft = createEmptyOnboardingDraft()
    const continueStep = () => persistStep(9, '91', draft, useOnboardingStore.getState().runtime,
      vi.fn(), vi.fn(), [], { onUploaded: store.recordUploadedImage })
    await expect(continueStep()).rejects.toMatchObject({ issues: [{ step: 9, field: 'store-banner-file', message: expect.stringContaining('Please retry the banner') }] })
    expect(save).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().runtime).toMatchObject({ logoFile: null, savedLogoUrl: 'https://images.example.test/logo.png', bannerFile: banner })
    await continueStep()
    expect(upload.mock.calls.map(([, kind]) => kind)).toEqual(['logo', 'banner', 'banner'])
    expect(save).toHaveBeenCalledWith('91', expect.objectContaining({
      uploadedLogoUrl: 'https://images.example.test/logo.png', uploadedBannerUrl: 'https://images.example.test/banner.gif',
    }))
    expect(useOnboardingStore.getState().runtime.bannerFile).toBeNull()
  })

  it('still tries the banner when the logo fails', async () => {
    const runtime = createEmptyRuntimeState()
    runtime.logoFile = new File(['png'], 'logo.png', { type: 'image/png' })
    runtime.bannerFile = new File(['png'], 'banner.png', { type: 'image/png' })
    const upload = vi.spyOn(vendorImagesService, 'uploadImage').mockRejectedValueOnce(new Error('Logo failed'))
      .mockResolvedValueOnce('https://images.example.test/banner.png')
    const onUploaded = vi.fn()
    await expect(savePendingImages('91', runtime, { onUploaded })).rejects.toThrow('Logo failed')
    expect(upload).toHaveBeenCalledTimes(2)
    expect(onUploaded).toHaveBeenCalledWith('banner', runtime.bannerFile, 'https://images.example.test/banner.png')
  })

  it('does not record a late response or start another write after ownership changes', async () => {
    const runtime = createEmptyRuntimeState()
    runtime.logoFile = new File(['png'], 'logo.png', { type: 'image/png' })
    runtime.bannerFile = new File(['png'], 'banner.png', { type: 'image/png' })
    let current = true
    let resolve!: (url: string) => void
    const upload = vi.spyOn(vendorImagesService, 'uploadImage').mockReturnValue(new Promise<string>((done) => { resolve = done }))
    const onUploaded = vi.fn()
    const saving = savePendingImages('91', runtime, { isCurrent: () => current, onUploaded })
    current = false
    resolve('https://images.example.test/logo.png')
    await expect(saving).rejects.toThrow('session has ended')
    expect(onUploaded).not.toHaveBeenCalled()
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('does not upload optional empty images', async () => {
    const upload = vi.spyOn(vendorImagesService, 'uploadImage').mockRejectedValue(new Error('Unexpected upload'))
    await expect(savePendingImages('91', createEmptyRuntimeState(), {})).resolves.toEqual({ logo: null, banner: null })
    expect(upload).not.toHaveBeenCalled()
  })
})
