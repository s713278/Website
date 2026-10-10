import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VendorCategoryRef, VendorProfile } from '@/shared/api'
import {
  invalidateOnboardingResources,
  loadOnboardingResource,
  peekOnboardingResource,
} from './onboarding-resource-cache'

afterEach(() => invalidateOnboardingResources())

const PROFILE: VendorProfile = {
  businessName: 'Green Bowl Grocers', businessType: null, ownerName: '', contactPerson: '', contactNumber: '',
}

const CATEGORIES: VendorCategoryRef[] = [
  { vendorCategoryId: 501, platformCategoryId: 10, name: 'Juices', imageUrl: null },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('loadOnboardingResource', () => {
  it('shares one read between callers that ask at the same time', async () => {
    const pending = deferred<VendorProfile | null>()
    const read = vi.fn(() => pending.promise)

    const first = loadOnboardingResource('96', 'profile', read)
    const second = loadOnboardingResource('96', 'profile', read)
    expect(read).toHaveBeenCalledTimes(1)

    pending.resolve(PROFILE)
    await expect(first).resolves.toBe(PROFILE)
    await expect(second).resolves.toBe(PROFILE)
    await loadOnboardingResource('96', 'profile', read)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('does not keep a failed read, so the next caller reads again', async () => {
    const read = vi.fn<() => Promise<VendorCategoryRef[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(CATEGORIES)

    await expect(loadOnboardingResource('96', 'categories', read)).rejects.toThrow('offline')
    expect(peekOnboardingResource('96', 'categories')).toBeNull()
    await expect(loadOnboardingResource('96', 'categories', read)).resolves.toBe(CATEGORIES)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('returns a late result to its caller but does not store it after an invalidate', async () => {
    const pending = deferred<VendorProfile | null>()
    const late = loadOnboardingResource('96', 'profile', () => pending.promise)

    invalidateOnboardingResources('96')
    pending.resolve(PROFILE)

    await expect(late).resolves.toBe(PROFILE)
    expect(peekOnboardingResource('96', 'profile')).toBeNull()
    const fresh = vi.fn(async () => ({ ...PROFILE, businessName: 'Fresh' }))
    await expect(loadOnboardingResource('96', 'profile', fresh)).resolves.toMatchObject({ businessName: 'Fresh' })
    expect(fresh).toHaveBeenCalledTimes(1)
  })

  it('does not let a late failure evict the entry that replaced it', async () => {
    const pending = deferred<VendorProfile | null>()
    const late = loadOnboardingResource('96', 'profile', () => pending.promise)
    invalidateOnboardingResources('96')
    await loadOnboardingResource('96', 'profile', async () => PROFILE)

    pending.reject(new Error('offline'))
    await expect(late).rejects.toThrow('offline')

    expect(peekOnboardingResource('96', 'profile')).toEqual({ value: PROFILE })
  })
})

describe('invalidateOnboardingResources', () => {
  async function fill(vendorId: string) {
    await loadOnboardingResource(vendorId, 'profile', async () => PROFILE)
    await loadOnboardingResource(vendorId, 'categories', async () => CATEGORIES)
    await loadOnboardingResource(vendorId, 'skus', async () => [])
  }

  it('drops only the named resources of the named vendor', async () => {
    await fill('96')
    await fill('97')

    invalidateOnboardingResources('96', ['skus'])

    expect(peekOnboardingResource('96', 'skus')).toBeNull()
    expect(peekOnboardingResource('96', 'profile')).toEqual({ value: PROFILE })
    expect(peekOnboardingResource('96', 'categories')).toEqual({ value: CATEGORIES })
    expect(peekOnboardingResource('97', 'skus')).toEqual({ value: [] })
  })

  it('drops every resource of one vendor and leaves other vendors', async () => {
    await fill('96')
    await fill('97')

    invalidateOnboardingResources('96')

    expect(peekOnboardingResource('96', 'profile')).toBeNull()
    expect(peekOnboardingResource('96', 'categories')).toBeNull()
    expect(peekOnboardingResource('97', 'profile')).toEqual({ value: PROFILE })
  })

  it('drops every vendor without a vendor id', async () => {
    await fill('96')
    await fill('97')

    invalidateOnboardingResources()

    expect(peekOnboardingResource('96', 'profile')).toBeNull()
    expect(peekOnboardingResource('97', 'categories')).toBeNull()
  })
})

describe('peekOnboardingResource', () => {
  it('tells a resolved null checkout apart from one not loaded or still in flight', async () => {
    expect(peekOnboardingResource('96', 'checkout')).toBeNull()

    const pending = deferred<null>()
    const load = loadOnboardingResource('96', 'checkout', () => pending.promise)
    expect(peekOnboardingResource('96', 'checkout')).toBeNull()

    pending.resolve(null)
    await load
    expect(peekOnboardingResource('96', 'checkout')).toEqual({ value: null })
  })
})
