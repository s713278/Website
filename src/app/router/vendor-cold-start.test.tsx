// @vitest-environment jsdom

// Its own file: the shell's `lazy()` factory, which starts the first page's chunk, runs once per
// module graph, so a cold start can only be observed by the first vendor route a file renders.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { invalidateVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { configureApiClient, mapVendorContext, vendorOnboardingService, type VendorContext } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { AppRouter } from './index'

const productsRequested = vi.hoisted(() => vi.fn())
vi.mock('@/modules/vendor/pages/VendorProductsPage', () => {
  productsRequested()
  return { VendorProductsPage: () => <h2>Products stub</h2> }
})

beforeEach(() => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_USE_API', 'false'); configureApiClient({ useApi: false })
  window.history.pushState({}, '', '/vendor/products')
  invalidateVendorContext()
  useAuthStore.getState().applySession({
    token: 'test-token',
    refreshToken: null,
    user: {
      id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
      role: 'vendor', roles: ['vendor'], vendors: [{ vendorId: 'vendor-1' }], vendorId: 'vendor-1',
    },
  })
  useAuthStore.getState().setHydrated(true)
})

afterEach(() => {
  cleanup()
  invalidateVendorContext()
  useAuthStore.getState().clearSession()
  useAuthStore.getState().setHydrated(false)
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('vendor cold start', () => {
  it('fetches the page chunk alongside the account read, so the page needs no loader of its own', async () => {
    let resolveContext!: (context: VendorContext) => void
    const readContext = vi.spyOn(vendorOnboardingService, 'getVendorContext')
      .mockReturnValue(new Promise<VendorContext>((resolve) => { resolveContext = resolve }))
    let loaderInMain = false
    const observer = new MutationObserver(() => {
      if (document.querySelector('main [data-slot="page-loader"]')) loaderInMain = true
    })
    observer.observe(document.body, { childList: true, subtree: true })

    render(<AppRouter />)

    await waitFor(() => expect(readContext).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(productsRequested).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('complementary', { name: 'Vendor navigation' })).toBeNull()

    await act(async () => resolveContext(mapVendorContext({
      data: { vendor_id: 'vendor-1', business_name: 'Test Store', vendor_status: 'ACTIVE', approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED', next_step: 11 } },
    })))

    expect(await screen.findByRole('heading', { name: 'Products stub' })).toBeTruthy()
    observer.disconnect()
    expect(loaderInMain).toBe(false)
  })
})
