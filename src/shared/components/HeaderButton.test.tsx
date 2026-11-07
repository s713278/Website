// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { HeaderButton } from './HeaderButton'

function ShowState() {
  const { state } = useLocation()
  return <p>{JSON.stringify(state)}</p>
}

afterEach(cleanup)

describe('HeaderButton', () => {
  it('links to its destination and carries router state', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <HeaderButton to="/login" state={{ from: '/stores/1' }} emphasis="secondary">
                Sign in
              </HeaderButton>
            }
          />
          <Route path="/login" element={<ShowState />} />
        </Routes>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Sign in' })
    expect(link.getAttribute('href')).toBe('/login')
    fireEvent.click(link)
    expect(screen.getByText('{"from":"/stores/1"}')).toBeTruthy()
  })

  it('shows the chevron on primary only', () => {
    render(
      <MemoryRouter>
        <HeaderButton to="/onboarding" emphasis="primary">Open store</HeaderButton>
        <HeaderButton to="/login" emphasis="secondary">Sign in</HeaderButton>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Open store' }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Sign in' }).querySelector('svg')).toBeNull()
  })
})
