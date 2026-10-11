import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VendorContext } from '@/shared/api'
import { clearVendorHeaderHint, readVendorHeaderHint } from '../store/vendor-header-hint-store'
import {
  invalidateVendorContext,
  contextSnapshotMayReplace,
  loadVendorContext,
  peekVendorContext,
} from './vendor-context-cache'

afterEach(() => {
  invalidateVendorContext()
  clearVendorHeaderHint()
})

function contextFor(vendorId: string): VendorContext {
  return {
    vendorId,
    businessName: 'Test Store',
    storeIdentifier: null,
    vendorStatus: 'INACTIVE',
    approvalStatus: 'PENDING',
    membershipRole: 'OWNER',
    onboarding: { status: 'IN_PROGRESS', description: null, nextStep: 1 },
    subscription: {
      tier: 'FREE',
      planName: 'Free',
      status: 'ACTIVE',
      currency: 'INR',
      monthlyPrice: 0,
      yearlyPrice: 0,
      trialEndsAt: null,
      trialDays: 0,
      limits: { maxCategories: 3, maxProducts: 10, maxSkus: 25, maxImages: 10 },
      usage: { categories: 1, products: 1, skus: 1, images: 0 },
    },
    eligibleFeatures: ['DASHBOARD'],
  }
}

describe('loadVendorContext', () => {
  it('reads once however many callers ask at the same time', async () => {
    // This is what StrictMode does in development: the effect runs twice before the
    // first read resolves. Without single-flighting, that is two requests per mount.
    const read = vi.fn(async (id: string) => contextFor(id))

    const [first, second] = await Promise.all([
      loadVendorContext('96', read),
      loadVendorContext('96', read),
    ])

    expect(read).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('serves a settled read without going back to the network', async () => {
    const read = vi.fn(async (id: string) => contextFor(id))
    await loadVendorContext('96', read)
    await loadVendorContext('96', read)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('keeps one vendor out of another vendor s entry', async () => {
    const read = vi.fn(async (id: string) => contextFor(id))
    const a = await loadVendorContext('96', read)
    const b = await loadVendorContext('97', read)

    expect(read).toHaveBeenCalledTimes(2)
    expect(a.vendorId).toBe('96')
    expect(b.vendorId).toBe('97')
  })

  it('drops a failed read so the next caller retries', async () => {
    const read = vi
      .fn<(id: string) => Promise<VendorContext>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(contextFor('96'))

    await expect(loadVendorContext('96', read)).rejects.toThrow('offline')
    // A retained failure would strand the vendor on an error nobody can clear.
    await expect(loadVendorContext('96', read)).resolves.toMatchObject({ vendorId: '96' })
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('re-reads after invalidation, which is how the shell reloads', async () => {
    const read = vi.fn(async (id: string) => contextFor(id))
    await loadVendorContext('96', read)
    invalidateVendorContext('96')
    await loadVendorContext('96', read)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('invalidates only the changed store after an onboarding write, and all stores on sign-out', async () => {
    const read = vi.fn(async (id: string) => contextFor(id))
    await loadVendorContext('96', read)
    await loadVendorContext('97', read)

    invalidateVendorContext('96')
    expect(peekVendorContext('96')).toBeNull()
    expect(peekVendorContext('97')).not.toBeNull()

    invalidateVendorContext()
    expect(peekVendorContext('97')).toBeNull()
  })

  it('does not restore pre-write context when an older request finishes after invalidation', async () => {
    let resolveOld!: (value: VendorContext) => void
    const oldRead = loadVendorContext('96', () => new Promise((resolve) => { resolveOld = resolve }))
    invalidateVendorContext('96')
    const current = { ...contextFor('96'), vendorStatus: 'ACTIVE' }
    await loadVendorContext('96', async () => current)

    resolveOld(contextFor('96'))
    await oldRead
    expect(peekVendorContext('96')).toBe(current)
  })

  it('forgets one vendor on invalidation, and everyone on sign-out', async () => {
    const read = vi.fn(async (id: string) => contextFor(id))
    await loadVendorContext('96', read)
    expect(peekVendorContext('96')).not.toBeNull()

    invalidateVendorContext('96')
    expect(peekVendorContext('96')).toBeNull()

    await loadVendorContext('96', read)
    await loadVendorContext('97', read)
    invalidateVendorContext()
    expect(peekVendorContext('96')).toBeNull()
    expect(peekVendorContext('97')).toBeNull()
  })

  it('peeks nothing while a read is still in flight', () => {
    let resolve!: (value: VendorContext) => void
    void loadVendorContext('96', () => new Promise<VendorContext>((res) => { resolve = res }))
    expect(peekVendorContext('96')).toBeNull()
    resolve(contextFor('96'))
  })

  it('rejects a lower billing revision with its associated plan and features', async () => {
    const newer = { ...contextFor('96'), billing: { revision: 4 }, eligibleFeatures: ['CATALOG'],
      subscription: { ...contextFor('96').subscription, planName: 'Paid' } }
    const older = { ...contextFor('96'), billing: { revision: 3 }, eligibleFeatures: ['VIEW'],
      subscription: { ...contextFor('96').subscription, planName: 'Free' } }
    await loadVendorContext('96', async () => newer)
    invalidateVendorContext('96')
    await expect(loadVendorContext('96', async () => older)).rejects.toThrow(/older/)
    expect(contextSnapshotMayReplace(newer, older)).toBe(false)
    expect(newer.subscription.planName).toBe('Paid')
    expect(newer.eligibleFeatures).toEqual(['CATALOG'])
  })

  it('keeps billing revision comparisons vendor scoped', async () => {
    await loadVendorContext('96', async () => ({ ...contextFor('96'), billing: { revision: 9 } }))
    await expect(loadVendorContext('97', async () => ({ ...contextFor('97'), billing: { revision: 1 } })))
      .resolves.toMatchObject({ vendorId: '97', billing: { revision: 1 } })
    expect(contextSnapshotMayReplace(contextFor('96'), contextFor('97'))).toBe(false)
  })

  describe('remembers the header hint', () => {
    it('from an accepted read', async () => {
      await loadVendorContext('96', async () => ({ ...contextFor('96'), vendorStatus: 'ACTIVE' }))

      expect(readVendorHeaderHint('96')).toMatchObject({ vendorId: '96', vendorStatus: 'ACTIVE' })
    })

    it('not from a read older than the last confirmed billing status', async () => {
      await loadVendorContext('96', async () => ({ ...contextFor('96'), billing: { revision: 4 }, vendorStatus: 'ACTIVE' }))
      invalidateVendorContext('96')

      await expect(loadVendorContext('96', async () => ({ ...contextFor('96'), billing: { revision: 3 } })))
        .rejects.toThrow(/older/)

      expect(readVendorHeaderHint('96')).toMatchObject({ vendorStatus: 'ACTIVE' })
    })

    it('not from a read superseded while it was in flight', async () => {
      let resolveOld!: (value: VendorContext) => void
      const oldRead = loadVendorContext('96', () => new Promise((resolve) => { resolveOld = resolve }))
      invalidateVendorContext('96')

      resolveOld({ ...contextFor('96'), vendorStatus: 'ACTIVE' })
      await oldRead

      expect(readVendorHeaderHint('96')).toBeNull()
    })

    it('not from a read for another store', async () => {
      await expect(loadVendorContext('96', async () => contextFor('97'))).rejects.toThrow(/another store/)

      expect(readVendorHeaderHint('96')).toBeNull()
      expect(readVendorHeaderHint('97')).toBeNull()
    })
  })
})
