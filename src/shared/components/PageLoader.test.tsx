// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PageLoader, PageLoaderScreen } from './PageLoader'

let clock = new Date('2026-01-01T00:00:00Z').getTime()

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
  // Each test starts well clear of the previous one's last visible loader.
  clock += 60_000
  vi.setSystemTime(clock)
})

const loader = (name = 'Loading') => screen.getByRole('status', { name })

describe('PageLoader', () => {
  it('names the wait and shows the mark only after the delay', () => {
    const { container } = render(<PageLoader />)
    expect(loader().textContent).toBe('Loading')
    expect(loader().getAttribute('data-state')).toBe('waiting')
    expect(container.querySelector('svg')).toBeNull()

    act(() => vi.advanceTimersByTime(300))

    expect(loader().getAttribute('data-state')).toBe('visible')
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(loader().textContent).toBe('Loading')
  })

  it('takes a custom label', () => {
    render(<PageLoader label="Loading your store" />)
    expect(loader('Loading your store').textContent).toBe('Loading your store')
  })

  it('shows at once when it takes over from a visible loader, then waits again later', () => {
    const first = render(<PageLoader label="A" />)
    act(() => vi.advanceTimersByTime(300))
    expect(loader('A').getAttribute('data-state')).toBe('visible')
    first.unmount()

    const second = render(<PageLoader label="B" />)
    expect(loader('B').getAttribute('data-state')).toBe('visible')
    second.unmount()

    act(() => vi.advanceTimersByTime(201))
    render(<PageLoader label="C" />)
    expect(loader('C').getAttribute('data-state')).toBe('waiting')
  })

  it('shows at once while another loader is visible', () => {
    render(<PageLoader label="A" />)
    act(() => vi.advanceTimersByTime(300))
    render(<PageLoader label="B" />)
    expect(loader('B').getAttribute('data-state')).toBe('visible')
  })
})

describe('PageLoaderScreen', () => {
  it('contains one status', () => {
    render(<PageLoaderScreen label="Restoring session" />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(loader('Restoring session')).toBeTruthy()
  })
})
