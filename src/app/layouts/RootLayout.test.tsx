// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { invalidateVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import { clearVendorHeaderHint } from '@/modules/vendor/store/vendor-header-hint-store'
import {
  authService,
  configureApiClient,
  mapVendorContext,
  vendorOnboardingService,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type { User } from '@/shared/types'
import { RootLayout } from './index'

const CUSTOMER: User = {
  id: 'test-user', name: 'Test Customer', email: 'customer@example.test',
  role: 'customer', roles: ['customer'], vendors: [],
}

const VENDOR: User = {
  id: 'test-vendor-user', name: 'Vendor', email: 'vendor@example.test',
  role: 'vendor', roles: ['vendor'],
  vendors: [{ vendorId: 'test-vendor', name: 'Green Bowl Grocers' }], vendorId: 'test-vendor',
}

const APPROVED = mapVendorContext({
  data: {
    vendor_id: 'test-vendor',
    vendor_status: 'ACTIVE',
    approval_status: 'APPROVED',
    store_identifier: 'green-bowl',
    onboarding: { status: 'COMPLETED', next_step: 11 },
  },
})

function goLive() {
  vi.stubEnv('VITE_USE_API', 'true')
  configureApiClient({ useApi: true })
}

function signIn(user: User) {
  useAuthStore.getState().applySession({ token: 'test-token', refreshToken: null, user })
}

function renderLayout(path = '/stores') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/stores" element={<h1>Stores page</h1>} />
          <Route path="/orders" element={<h1>Orders page</h1>} />
          <Route path="/onboarding" element={<h1>Onboarding page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

/** Radix opens the menu on a key press; jsdom has no pointer events for its trigger. */
function openAccountMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Account' }), { key: 'Enter' })
  return screen.getByRole('menu')
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_API', 'false')
  configureApiClient({ useApi: false })
  vi.spyOn(authService, 'signOut').mockResolvedValue()
})

afterEach(() => {
  cleanup()
  invalidateVendorContext()
  clearVendorHeaderHint()
  useAuthStore.getState().clearSession()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('RootLayout mobile menu', () => {
  it('opens and closes from the menu button', () => {
    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('closes once a link in it takes the shopper to another page', () => {
    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    // The bar and the menu each render the actions; the menu's copy is the last one.
    fireEvent.click(screen.getAllByRole('link', { name: 'Get started' }).at(-1)!)

    expect(screen.getByRole('heading', { name: 'Onboarding page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('lists the constructive action first', () => {
    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const menuLinks = [...document.querySelectorAll('#general-header-menu a')].map((a) => a.textContent?.trim())

    expect(menuLinks).toEqual(['Get started', 'Sign in'])
  })

  it('is not offered to a signed-in customer, who has no action to put in it', () => {
    signIn(CUSTOMER)
    renderLayout()

    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})

/** Each destination's links, by href, so a duplicate in the bar shows up as a second entry. */
function hrefsOf(name: string | RegExp) {
  return screen.queryAllByRole('link', { name }).map((link) => link.getAttribute('href'))
}

describe('RootLayout destinations', () => {
  it('keeps Stores in the bar for everyone, active on /stores', () => {
    renderLayout('/stores')

    const stores = screen.getByRole('link', { name: 'Stores' })
    expect(stores.getAttribute('href')).toBe('/stores')
    expect(stores.getAttribute('aria-current')).toBe('page')
  })

  it('offers a signed-out shopper customer Sign in and Get started, in place', () => {
    renderLayout()

    expect(new Set(hrefsOf('Sign in'))).toEqual(new Set(['/login']))
    expect(new Set(hrefsOf('Get started'))).toEqual(new Set(['/onboarding']))
    expect(screen.getAllByRole('link', { name: 'Get started' })[0].getAttribute('target')).toBeNull()
    expect(hrefsOf('Open store')).toEqual([])
  })

  it('hides the cart from a live guest, who cannot hold one', () => {
    goLive()
    renderLayout()

    expect(screen.queryByRole('link', { name: /^Cart/ })).toBeNull()
    expect(new Set(hrefsOf('Sign in'))).toEqual(new Set(['/login']))
  })

  it('gives a customer Stores and the cart, and leaves My orders to the account menu', () => {
    signIn(CUSTOMER)
    renderLayout()

    expect(hrefsOf(/^Cart/)).toEqual(['/cart'])
    for (const gone of ['Home', 'Orders', 'Get started', 'Sign in']) expect(hrefsOf(gone)).toEqual([])
  })

  it('offers an unfinished vendor Continue setup, with Dashboard only in the account menu', () => {
    signIn(VENDOR)
    renderLayout()

    expect(new Set(hrefsOf('Continue setup'))).toEqual(new Set(['/onboarding']))
    for (const gone of ['Store setup', 'Dashboard', 'Home']) expect(hrefsOf(gone)).toEqual([])
    expect(screen.queryByRole('link', { name: /^Cart/ })).toBeNull()
  })

  it('offers an approved vendor their Store, in place', async () => {
    goLive()
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(APPROVED)
    signIn(VENDOR)
    renderLayout()
    // The header requested this module first, so its read has been issued by the time this resolves.
    await import('@/modules/vendor/lib/onboarding-server-state')

    await waitFor(() => expect(new Set(hrefsOf('Store'))).toEqual(new Set(['/stores/green-bowl'])))
    expect(screen.getAllByRole('link', { name: 'Store' })[0].getAttribute('target')).toBeNull()
    for (const gone of ['Store setup', 'Dashboard', 'Continue setup']) expect(hrefsOf(gone)).toEqual([])
    expect(screen.queryByRole('link', { name: /^Cart/ })).toBeNull()
  })
})

describe('RootLayout header controls', () => {
  it('shows the cart as one icon with its count, and no account menu, when signed out', () => {
    renderLayout()

    const cart = screen.getByRole('link', { name: /^Cart/ })
    expect(cart.getAttribute('href')).toBe('/cart')
    // An icon, not the old text link.
    expect(cart.textContent).toBe('')
    expect(screen.getAllByRole('link', { name: /^Cart/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull()
  })

  it('gives a customer an account menu with their name, My orders and Sign out', async () => {
    signIn(CUSTOMER)
    renderLayout()
    expect(screen.queryAllByText(/Welcome/)).toHaveLength(0)

    const menu = openAccountMenu()

    expect(menu.textContent).toContain('Test Customer')
    expect(screen.getByRole('menuitem', { name: 'My orders' }).getAttribute('href')).toBe('/orders')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull())
  })

  it('closes the open mobile menu when the account menu signs out', async () => {
    signIn(VENDOR)
    renderLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    openAccountMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull())
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('labels a vendor’s menu with the store name and offers Dashboard', () => {
    signIn(VENDOR)
    renderLayout()
    expect(screen.queryAllByText(/Welcome/)).toHaveLength(0)

    const menu = openAccountMenu()

    expect(menu.textContent).toContain('Green Bowl Grocers')
    expect(menu.textContent).not.toMatch(/\bVendor\b/)
    expect(screen.getByRole('menuitem', { name: 'Dashboard' }).getAttribute('href')).toBe('/vendor')
    expect(screen.queryByRole('menuitem', { name: 'My orders' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy()
  })
})
