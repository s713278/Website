// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/modules/vendor/lib/onboarding-draft-keys'
import {
  invalidateMeasurementCatalog,
  loadMeasurementCatalog,
  peekMeasurementCatalog,
} from '@/modules/vendor/lib/measurement-catalog-cache'
import {
  invalidateOnboardingResources,
  loadOnboardingResource,
  peekOnboardingResource,
} from '@/modules/vendor/lib/onboarding-resource-cache'
import { invalidateVendorContext, loadVendorContext, peekVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { authService, mapVendorContext } from '@/shared/api'
// Reached by its own path rather than through the `@/shared/api` façade on purpose. The
// subject here is the stored value's survival, not API behaviour, and the façade
// deliberately does not export the store: no screen may know where the record is kept.
import { readPaidOrders, recordPaidOrder } from '@/shared/api/services/paid-orders-store'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { CART_STORAGE_KEY, useCartStore } from '@/modules/storefront/store/cart-store'
import { AppProviders } from './AppProviders'

/**
 * What sign-out is allowed to take with it.
 *
 * The handlers that clear browser-local state are registered here, so this is the only
 * place the whole set can be seen at once — and the only place a new one silently added to
 * the vendor's payment record would show up.
 */

afterEach(() => {
  cleanup()
  invalidateOnboardingResources()
  invalidateVendorContext()
  invalidateMeasurementCatalog()
  useAuthStore.getState().clearSession()
  localStorage.clear()
  vi.restoreAllMocks()
})

function signIn() {
  useAuthStore.getState().applySession({
    token: 'synthetic-access-token',
    refreshToken: 'synthetic-refresh-token',
    user: {
      id: 'test-user',
      name: 'Test Vendor',
      email: 'vendor@example.test',
      role: 'vendor',
      roles: ['vendor'],
      vendors: [{ vendorId: '262' }],
      vendorId: '262',
    },
  })
}

describe('sign-out cleanup', () => {
  it('leaves the vendor payment record alone while clearing the onboarding draft', async () => {
    // The record is a vendor's ledger and the only copy anywhere: no backend route stores
    // a payment. Clearing it with the session would destroy it every time they signed out
    // on a shared phone. See
    // `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`.
    const signOut = vi.spyOn(authService, 'signOut').mockResolvedValue(undefined)
    localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, '{"version":3}')
    recordPaidOrder('262', '1931', true)

    render(<AppProviders>{null}</AppProviders>)
    signIn()
    await useAuthStore.getState().logout()

    expect(signOut).toHaveBeenCalled()
    // The draft going proves the cleanup handlers really ran, so the record surviving is
    // a fact about the record rather than about a test that cleaned nothing up.
    expect(localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect([...readPaidOrders('262')]).toEqual(['1931'])

    signIn()
    expect([...readPaidOrders('262')]).toEqual(['1931'])
  })

  it('clears the customer cart persist and session caches on logout', async () => {
    const signOut = vi.spyOn(authService, 'signOut').mockResolvedValue(undefined)
    render(<AppProviders>{null}</AppProviders>)
    signIn()
    useCartStore.getState().addPendingLine({
      vendorId: '91',
      storeName: 'Shop',
      productId: '12',
      skuId: '101',
      qty: 1,
      name: 'Pickle',
      label: '250 g',
      price: 180,
      returnTo: '/stores/91',
    })
    expect(useCartStore.getState().lines).toHaveLength(1)

    await useAuthStore.getState().logout()

    expect(signOut).toHaveBeenCalled()
    expect(useCartStore.getState().lines).toEqual([])
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  describe('the vendor’s cached account reads', () => {
    const readContext = vi.fn(async (vendorId: string) => mapVendorContext({
      data: { vendor_id: vendorId, vendor_status: 'SETTING_UP', approval_status: 'PENDING' },
    }))
    const readCheckout = vi.fn(async () => null)
    const readUnits = vi.fn(async () => [])

    async function loadAll() {
      await loadVendorContext('262', readContext)
      await loadOnboardingResource('262', 'checkout', readCheckout)
      await loadMeasurementCatalog(readUnits)
    }

    it('are dropped on an explicit sign-out, so the next load reads them again', async () => {
      vi.spyOn(authService, 'signOut').mockResolvedValue(undefined)
      render(<AppProviders>{null}</AppProviders>)
      signIn()
      await loadAll()

      await useAuthStore.getState().logout()

      expect(peekVendorContext('262')).toBeNull()
      expect(peekOnboardingResource('262', 'checkout')).toBeNull()
      expect(peekMeasurementCatalog()).toBeNull()
      readContext.mockClear()
      readCheckout.mockClear()
      readUnits.mockClear()
      await loadAll()
      expect(readContext).toHaveBeenCalledTimes(1)
      expect(readCheckout).toHaveBeenCalledTimes(1)
      expect(readUnits).toHaveBeenCalledTimes(1)
    })

    it('survive an involuntary session loss', async () => {
      render(<AppProviders>{null}</AppProviders>)
      signIn()
      await loadAll()

      // What `onUnauthorized` does after a failed refresh.
      useAuthStore.getState().clearSession()

      expect(peekVendorContext('262')).not.toBeNull()
      expect(peekOnboardingResource('262', 'checkout')).not.toBeNull()
      expect(peekMeasurementCatalog()).not.toBeNull()
    })
  })
})
