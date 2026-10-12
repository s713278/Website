// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { RootLayout } from './index'

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

afterEach(() => {
  cleanup()
  useAuthStore.getState().clearSession()
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
    useAuthStore.getState().applySession({
      token: 'test-token',
      refreshToken: null,
      user: { id: 'test-user', name: 'Test Customer', email: 'customer@example.test', role: 'customer', roles: ['customer'], vendors: [] },
    })
    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    // The bar and the menu each render the links; the menu's copy is the last one.
    fireEvent.click(screen.getAllByRole('link', { name: 'Orders' }).at(-1)!)

    expect(screen.getByRole('heading', { name: 'Orders page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false')
  })
})
