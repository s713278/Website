// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { vendorProductsService, type AuthSession } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type { VendorProduct } from '@/modules/vendor/types'
import { VendorProductsPage } from './VendorProductsPage'

/**
 * Vitest globals are off, so Testing Library's automatic cleanup never registers itself.
 * Unmount by hand, or the previous render stays in the document and `screen` queries
 * match two copies of the page.
 */
afterEach(() => {
  cleanup()
  useAuthStore.getState().clearSession()
  vi.restoreAllMocks()
})

/** Session changes go through `applySession` because that is the only path production takes. */
function vendorSession(vendorId: string): AuthSession {
  return {
    token: `test-token-${vendorId}`,
    refreshToken: null,
    user: {
      id: `u-${vendorId}`,
      name: 'Test Vendor',
      email: `${vendorId}@mithra.local`,
      role: 'vendor',
      roles: ['vendor'],
      vendors: [{ vendorId }],
      vendorId,
    },
  }
}

/** A promise this test settles by hand, so the two responses can land out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function product(name: string): VendorProduct {
  return { id: name, name, price: 100, available: true, veg: true }
}

describe('VendorProductsPage', () => {
  it('ignores a stale response that lands after the vendor changed', async () => {
    const first = deferred<VendorProduct[]>()
    const second = deferred<VendorProduct[]>()
    const list = vi
      .spyOn(vendorProductsService, 'list')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    useAuthStore.getState().applySession(vendorSession('vendor-a'))
    render(<VendorProductsPage />)
    expect(list).toHaveBeenCalledWith('vendor-a')

    // Switching vendor tears down the first effect and starts a second request.
    await act(async () => {
      useAuthStore.getState().applySession(vendorSession('vendor-b'))
    })
    expect(list).toHaveBeenCalledWith('vendor-b')

    // The current vendor answers first; the abandoned request lands afterwards.
    await act(async () => {
      second.resolve([product('Vendor B item')])
    })
    await act(async () => {
      first.resolve([product('Vendor A item')])
    })

    expect(screen.getByText('Vendor B item')).toBeDefined()
    expect(screen.queryByText('Vendor A item')).toBeNull()
  })
})
