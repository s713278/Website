// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LoadError } from './LoadError'

afterEach(cleanup)

describe('LoadError', () => {
  it('shows the fixed alert and retries on Try again', () => {
    const onRetry = vi.fn()
    render(<LoadError onRetry={onRetry} />)

    expect(within(screen.getByRole('alert')).getByText('Something went wrong')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders extra actions beside Try again', () => {
    render(
      <LoadError onRetry={() => {}}>
        <button type="button">Use sample catalog</button>
      </LoadError>,
    )

    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Use sample catalog' })).toBeTruthy()
  })
})
