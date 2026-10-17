// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoadingStatus } from './LoadingStatus'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.stubGlobal('navigator', { ...navigator, onLine: true })
})

describe('LoadingStatus', () => {
  it('shows the label while loading and nothing when idle', () => {
    const { rerender, container } = render(
      <LoadingStatus loading label="Loading cart…" />,
    )
    expect(screen.getByText('Loading cart…')).toBeTruthy()

    rerender(<LoadingStatus loading={false} label="Loading cart…" />)
    expect(container.firstChild).toBeNull()
  })

  it('keeps the same label after a long wait and offers Retry', () => {
    vi.useFakeTimers()
    render(
      <LoadingStatus loading label="Loading cart…" onRetry={() => undefined} />,
    )
    expect(screen.getByText('Loading cart…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.getByText('Loading cart…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('shows offline copy when the device is offline', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })
    render(
      <LoadingStatus loading label="Loading cart…" onRetry={() => undefined} />,
    )
    expect(screen.getByText("You're offline")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
