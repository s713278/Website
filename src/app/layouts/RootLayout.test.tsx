// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { authService, configureApiClient } from '@/shared/api'
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
    signIn(CUSTOMER)
    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    // The bar and the menu each render the links; the menu's copy is the last one.
    fireEvent.click(screen.getAllByRole('link', { name: 'Orders' }).at(-1)!)

    expect(screen.getByRole('heading', { name: 'Orders page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false')
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
    signIn(CUSTOMER)
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
