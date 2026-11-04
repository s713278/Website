// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOADER_SHOW_DELAY_MS, useShowAfterDelay } from './useShowAfterDelay'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
})

function Probe({ startVisible }: { startVisible?: boolean }) {
  const visible = useShowAfterDelay(LOADER_SHOW_DELAY_MS, startVisible)
  return <span data-testid="probe">{visible ? 'visible' : 'waiting'}</span>
}

describe('useShowAfterDelay', () => {
  it('stays hidden until the delay passes', () => {
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('waiting')
    act(() => vi.advanceTimersByTime(299))
    expect(screen.getByTestId('probe').textContent).toBe('waiting')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByTestId('probe').textContent).toBe('visible')
  })

  it('is visible at once when asked to start visible', () => {
    render(<Probe startVisible />)
    expect(screen.getByTestId('probe').textContent).toBe('visible')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its timer on unmount', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<Probe />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(LOADER_SHOW_DELAY_MS))
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})
