// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { vendorProductsService } from '@/shared/api'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorSize } from '@/modules/vendor/types/dashboard'
import { VendorProductsPage } from './VendorProductsPage'

/**
 * Vitest globals are off, so Testing Library's automatic cleanup never registers itself.
 * Unmount by hand, or the previous render stays in the document and `screen` queries
 * match two copies of the page.
 */
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/**
 * The account comes from the shell, so the page is rendered against a fixed one. That is
 * the point of the provider: a page no longer resolves its own vendor id, and no longer
 * falls back to a hardcoded demo id when the session has none.
 */
function accountFor(vendorId: string): VendorAccount {
  return {
    vendorId,
    context: {
      vendorId,
      businessName: 'Test Store',
      storeIdentifier: null,
      vendorStatus: 'ACTIVE',
      approvalStatus: 'APPROVED',
      membershipRole: 'OWNER',
      onboarding: { status: 'COMPLETED', description: null, nextStep: 11 },
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
    },
    storeState: 'OPEN',
    plan: {
      tier: 'FREE',
      name: 'Free',
      status: 'ACTIVE',
      currency: 'INR',
      monthlyPrice: 0,
      yearlyPrice: 0,
      trialEndsAt: null,
      trialDays: 0,
      limits: { categories: 3, products: 10, skus: 25, images: 10 },
      usage: { categories: 1, products: 1, skus: 1, images: 0 },
    },
    reload: () => {},
  }
}

function renderFor(vendorId: string) {
  return render(
    <VendorAccountContext.Provider value={accountFor(vendorId)}>
      <VendorProductsPage />
    </VendorAccountContext.Provider>,
  )
}

/** A promise this test settles by hand, so the two responses can land out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function size(name: string): VendorSize {
  return {
    skuId: `sku-${name}`,
    productId: `p-${name}`,
    priceId: `price-${name}`,
    name,
    size: '1 kg',
    listPrice: 100,
    salePrice: 90,
    active: true,
    imagePath: null,
  }
}

describe('VendorProductsPage', () => {
  it('ignores a response that arrives after the page moved to another store', async () => {
    // The contract every dashboard surface depends on: a torn-down fetch must not
    // overwrite fresh state. Resolving out of order is what reproduces it.
    const first = deferred<VendorSize[]>()
    const second = deferred<VendorSize[]>()
    const listSizes = vi
      .spyOn(vendorProductsService, 'listSizes')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const view = renderFor('vendor-1')
    view.rerender(
      <VendorAccountContext.Provider value={accountFor('vendor-2')}>
        <VendorProductsPage />
      </VendorAccountContext.Provider>,
    )

    await act(async () => {
      second.resolve([size('Fresh Tomatoes')])
      first.resolve([size('Stale Rice')])
      await Promise.resolve()
    })

    expect(listSizes).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Fresh Tomatoes')).toBeTruthy()
    expect(screen.queryByText('Stale Rice')).toBeNull()
  })

  it('offers no price control for a size with no price record', async () => {
    // The write is addressed to the price id; without one there is nowhere to send it.
    const priceless: VendorSize = { ...size('Loose Grain'), priceId: null }
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([priceless])

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('No price record')).toBeTruthy()
    expect(screen.queryByText('Edit price')).toBeNull()
  })
})
