// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Spinner } from '.'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
})

describe('Spinner', () => {
  it('is a status named Loading by default, with no visible text', () => {
    render(<Spinner />)
    const status = screen.getByRole('status', { name: 'Loading' })
    expect(status.textContent).toBe('Loading')
    expect(status.querySelector('.sr-only')?.textContent).toBe('Loading')
  })

  it('takes a custom label', () => {
    render(<Spinner label="Loading orders" />)
    expect(screen.getByRole('status', { name: 'Loading orders' }).textContent).toBe('Loading orders')
  })

  it('draws a decorative, reduced-motion-safe icon only after the delay', () => {
    render(<Spinner />)
    const status = screen.getByRole('status', { name: 'Loading' })
    expect(status.querySelector('svg')).toBeNull()

    act(() => vi.advanceTimersByTime(300))

    const icon = status.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute('aria-hidden')).toBe('true')
    expect(icon!.getAttribute('role')).toBeNull()
    expect(icon!.getAttribute('class')).toContain('motion-reduce:animate-none')
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
})
