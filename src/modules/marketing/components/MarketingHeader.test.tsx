// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { loadVendorOnboardingState } from '@/modules/vendor/lib/onboarding-server-state'
import { invalidateVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import { loadVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { clearVendorHeaderHint, rememberVendorHeaderHint } from '@/modules/vendor/store/vendor-header-hint-store'
import {
  configureApiClient,
  mapVendorContext,
  vendorOnboardingService,
  type VendorContext,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { MarketingHeader } from './MarketingHeader'

const VENDOR_ID = 'test-vendor'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

/** A read that never answers, which is what a slow backend looks like from the header. */
const neverSettles = () => new Promise<never>(() => {})

function vendorContext(
  vendorStatus: string,
  approvalStatus: string,
  nextStep: number,
  storeIdentifier: string | null = 'sk-organic-store',
): VendorContext {
  return mapVendorContext({
    data: {
      vendor_id: VENDOR_ID,
      vendor_status: vendorStatus,
      approval_status: approvalStatus,
      store_identifier: storeIdentifier,
      onboarding: { status: nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS', next_step: nextStep },
    },
  })
}

const APPROVED = vendorContext('ACTIVE', 'APPROVED', 11)
const SETTING_UP = vendorContext('SETTING_UP', 'PENDING', 5, null)

/** The wizard's resume reads other than the context, held open. */
function holdSetupReads() {
  vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockReturnValue(neverSettles())
  vi.spyOn(vendorOnboardingService, 'getBusinessTypes').mockReturnValue(neverSettles())
  vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockReturnValue(neverSettles())
  vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockReturnValue(neverSettles())
  vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockReturnValue(neverSettles())
  vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockReturnValue(neverSettles())
  vi.spyOn(vendorOnboardingService, 'getMeasurements').mockReturnValue(neverSettles())
}

/** The same reads, answered with an empty account. */
function answerSetupReads() {
  vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
    businessName: 'Green Bowl Grocers', businessType: null, ownerName: '', contactPerson: '', contactNumber: '',
  })
  vi.spyOn(vendorOnboardingService, 'getBusinessTypes').mockResolvedValue({
    items: [], pageNumber: 0, pageSize: 100, totalElements: 0, totalPages: 0, lastPage: true,
  })
  vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([])
  vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockResolvedValue([])
  vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockResolvedValue([])
  vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(null)
  vi.spyOn(vendorOnboardingService, 'getMeasurements').mockResolvedValue([])
}

const ACTIONS = ['Log in', 'Get started', 'Continue setup', 'Check status', 'Store', 'Dashboard', 'Log out']

/**
 * The header's right-hand actions, in order. Each one is in the DOM twice, once for the bar and
 * once for the mobile menu, and a button inside a link matches both elements; CSS hides the
 * extras in a browser, but jsdom applies none.
 */
function shownActions(): string[] {
  const labels = [...screen.getByRole('banner').querySelectorAll('a, button')]
    .map((element) => element.textContent?.trim() ?? '')
    .filter((label) => ACTIONS.includes(label))
  return [...new Set(labels)]
}

function renderHeader(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MarketingHeader />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_API', 'true')
  configureApiClient({ useApi: true })
  invalidateVendorOnboardingState()
  // Every accepted read writes the remembered hint, which would otherwise carry one test's
  // account into the next test's first paint.
  clearVendorHeaderHint()
  useAuthStore.getState().applySession({
    token: 'test-token',
    refreshToken: null,
    user: {
      id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
      role: 'vendor', roles: ['vendor'],
      vendors: [{ vendorId: VENDOR_ID }], vendorId: VENDOR_ID,
    },
  })
})

afterEach(() => {
  cleanup()
  invalidateVendorOnboardingState()
  clearVendorHeaderHint()
  useAuthStore.getState().clearSession()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('MarketingHeader for a signed-in vendor', () => {
  it('offers Dashboard from the first paint, before the account has loaded', () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(neverSettles())
    holdSetupReads()

    renderHeader()

    expect(shownActions()).toEqual(['Dashboard'])
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0].getAttribute('href')).toBe('/vendor')
  })

  // The setup reads are held open for good. A header that waited for them, as the wizard does,
  // would never get past its first paint.
  it.each([
    ['an approved store', APPROVED, ['Store', 'Dashboard']],
    ['a submitted store awaiting approval', vendorContext('ACTIVE', 'PENDING', 11), ['Check status']],
    ['unfinished setup', SETTING_UP, ['Log out', 'Continue setup']],
  ] as const)('settles on %s once the vendor context lands, without the setup reads', async (_name, context, expected) => {
    const read = deferred<VendorContext>()
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(read.promise)
    holdSetupReads()
    renderHeader()

    read.resolve(context)

    await waitFor(() => expect(shownActions()).toEqual(expected))
  })

  it('keeps Dashboard in place when an approved store lands, rather than swapping it', async () => {
    const read = deferred<VendorContext>()
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(read.promise)
    holdSetupReads()
    renderHeader()
    const before = screen.getAllByRole('link', { name: 'Dashboard' })[0]

    read.resolve(APPROVED)

    await waitFor(() => expect(shownActions()).toEqual(['Store', 'Dashboard']))
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toBe(before)
  })

  it('starts no read once the header is gone', async () => {
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(neverSettles())
    holdSetupReads()
    const { unmount } = renderHeader()

    unmount()
    // The header requested this module first, so its continuation has run by the time this resolves.
    await import('@/modules/vendor/lib/onboarding-server-state')

    expect(getContext).not.toHaveBeenCalled()
  })

  describe('when an earlier read already holds the account', () => {
    it.each([
      ['sign-in or the wizard', () => loadVendorOnboardingState(VENDOR_ID)],
      ['the dashboard', () => loadVendorContext(VENDOR_ID, (id) => vendorOnboardingService.getVendorContext(id))],
    ] as const)('paints the answer on the first frame, with no Dashboard to correct, after %s', async (_name, read) => {
      vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(SETTING_UP)
      answerSetupReads()
      await read()

      renderHeader()

      expect(shownActions()).toEqual(['Log out', 'Continue setup'])
    })
  })

  describe('on /onboarding', () => {
    it('shares the wizard’s read rather than asking for the context a second time', async () => {
      const read = deferred<VendorContext>()
      const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(read.promise)
      answerSetupReads()
      // The wizard starts its own read as it mounts, so it is already in flight.
      void loadVendorOnboardingState(VENDOR_ID)
      renderHeader('/onboarding')

      // The header requested this module first, so its read has been issued by the time this
      // resolves. Checked while the wizard's read is still in flight: once it has settled, a
      // second reader would be served from the cache and the duplicate would go unseen.
      await import('@/modules/vendor/lib/onboarding-server-state')
      expect(getContext).toHaveBeenCalledTimes(1)

      read.resolve(APPROVED)

      await waitFor(() => expect(shownActions()).toEqual(['Store', 'Dashboard']))
      expect(getContext).toHaveBeenCalledTimes(1)
    })

    it('stays empty while the read is in flight, as the wizard owns the page', () => {
      vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(neverSettles())
      holdSetupReads()

      renderHeader('/onboarding')

      expect(shownActions()).toEqual([])
    })
  })

  // TEMP(vendor-header-hint): the remembered account state paints the first frame until the
  // live read lands, and the live read still wins once it does.
  describe('with a remembered account state', () => {
    it.each([
      ['an approved store', APPROVED, ['Store', 'Dashboard']],
      ['a submitted store awaiting approval', vendorContext('ACTIVE', 'PENDING', 11), ['Check status']],
      ['unfinished setup', SETTING_UP, ['Log out', 'Continue setup']],
    ] as const)('paints %s on the first frame while the read is pending', (_name, context, expected) => {
      rememberVendorHeaderHint(context)
      vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(neverSettles())
      holdSetupReads()

      renderHeader()

      expect(shownActions()).toEqual(expected)
    })

    it('corrects itself when the live read disagrees', async () => {
      rememberVendorHeaderHint(APPROVED)
      const read = deferred<VendorContext>()
      vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(read.promise)
      holdSetupReads()
      renderHeader()
      expect(shownActions()).toEqual(['Store', 'Dashboard'])

      read.resolve(SETTING_UP)

      await waitFor(() => expect(shownActions()).toEqual(['Log out', 'Continue setup']))
    })

    it('keeps the remembered actions when the live read fails', async () => {
      rememberVendorHeaderHint(APPROVED)
      const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('offline'))
      holdSetupReads()

      renderHeader()

      await waitFor(() => expect(getContext).toHaveBeenCalled())
      // Lets the rejection reach the header and its state update render.
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
      expect(shownActions()).toEqual(['Store', 'Dashboard'])
    })

    it('ignores a state remembered for another vendor', () => {
      rememberVendorHeaderHint({ ...APPROVED, vendorId: 'another-vendor' })
      vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(neverSettles())
      holdSetupReads()

      renderHeader()

      expect(shownActions()).toEqual(['Dashboard'])
    })

    it('paints the remembered actions on /onboarding and stays there', () => {
      rememberVendorHeaderHint(APPROVED)
      vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(neverSettles())
      holdSetupReads()
      const seen: string[] = []
      function LocationProbe() {
        seen.push(useLocation().pathname)
        return null
      }

      render(
        <MemoryRouter initialEntries={['/onboarding']}>
          <MarketingHeader />
          <LocationProbe />
        </MemoryRouter>,
      )

      expect(shownActions()).toEqual(['Store', 'Dashboard'])
      expect(new Set(seen)).toEqual(new Set(['/onboarding']))
    })
  })

  it('falls back to Log out and Continue setup when the read fails and nothing is remembered', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('offline'))
    holdSetupReads()

    renderHeader()

    await waitFor(() => expect(shownActions()).toEqual(['Log out', 'Continue setup']))
  })
})
