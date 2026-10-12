// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { configureApiClient } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type { User } from '@/shared/types'
import { StorefrontHeader } from './StorefrontHeader'

const CUSTOMER: User = {
  id: 'test-user', name: 'Test Customer', email: 'customer@example.test',
  role: 'customer', roles: ['customer'], vendors: [],
}

function setMode(live: boolean) {
  vi.stubEnv('VITE_USE_API', String(live))
  configureApiClient({ useApi: live })
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/stores/test-store']}>
      <StorefrontHeader storeId="test-store" storeName="Green Bowl Grocers" cartCount={2} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  useAuthStore.getState().clearSession()
  vi.unstubAllEnvs()
})

describe('StorefrontHeader cart', () => {
  it('is hidden from a live guest, who cannot hold a cart, leaving Sign in as the way in', () => {
    setMode(true)
    renderHeader()

    expect(screen.queryByRole('link', { name: /^Cart/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login')
  })

  it('opens the shop cart for a live customer', () => {
    setMode(true)
    useAuthStore.getState().applySession({ token: 'test-token', refreshToken: null, user: CUSTOMER })
    renderHeader()

    expect(screen.getByRole('link', { name: 'Cart, 2 items' }).getAttribute('href')).toBe('/stores/test-store/cart')
  })

  it('opens the shop cart for a demo guest', () => {
    setMode(false)
    renderHeader()

    expect(screen.getByRole('link', { name: 'Cart, 2 items' }).getAttribute('href')).toBe('/stores/test-store/cart')
  })
})
