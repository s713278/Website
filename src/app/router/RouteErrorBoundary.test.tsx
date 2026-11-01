// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { RouteErrorBoundary } from './RouteErrorBoundary'

function Boom(): never {
  throw new Error('chunk failed')
}

let mounts = 0
function MountCounter() {
  useEffect(() => {
    mounts += 1
  }, [])
  return <p>Counter</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Link to="/fine">Go fine</Link>
      <Link to="/other">Go other</Link>
      <RouteErrorBoundary>
        <MountCounter />
        <Routes>
          <Route path="/boom" element={<Boom />} />
          <Route path="/fine" element={<p>Fine page</p>} />
          <Route path="/other" element={<p>Other page</p>} />
        </Routes>
      </RouteErrorBoundary>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mounts = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RouteErrorBoundary', () => {
  it('shows the full-screen LoadError when a route throws and reloads on Try again', () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    try {
      renderAt('/boom')
      expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })

  it('resets after a failure once the pathname changes', () => {
    render(
      <MemoryRouter initialEntries={['/boom']}>
        <Link to="/fine">Go fine</Link>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/boom" element={<Boom />} />
            <Route path="/fine" element={<p>Fine page</p>} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    fireEvent.click(screen.getByRole('link', { name: 'Go fine' }))

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Fine page')).toBeTruthy()
  })

  it('does not remount its children on a normal navigation', () => {
    renderAt('/fine')
    expect(screen.getByText('Fine page')).toBeTruthy()
    expect(mounts).toBe(1)

    fireEvent.click(screen.getByRole('link', { name: 'Go other' }))

    expect(screen.getByText('Other page')).toBeTruthy()
    expect(mounts).toBe(1)
  })
})
