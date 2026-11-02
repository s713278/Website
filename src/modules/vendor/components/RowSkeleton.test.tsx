// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { RowSkeleton } from './RowSkeleton'

afterEach(cleanup)

function rowClasses(container: HTMLElement) {
  const rows = container.querySelectorAll('[data-slot="skeleton"]')
  expect(rows.length).toBe(4)
  return rows[0].className.split(/\s+/)
}

describe('RowSkeleton', () => {
  it('uses the default responsive row height when no height is passed', () => {
    const { container } = render(<RowSkeleton label="Loading orders" />)

    const classes = rowClasses(container)
    expect(classes).toContain('h-64')
    expect(classes).toContain('xl:h-[4.5rem]')
    expect(classes).toContain('w-full')
  })

  it('replaces the default height with the one a caller passes', () => {
    const { container } = render(<RowSkeleton label="Loading subscriptions" rowClassName="h-84 sm:h-32" />)

    const classes = rowClasses(container)
    expect(classes).toContain('h-84')
    expect(classes).toContain('sm:h-32')
    expect(classes).not.toContain('h-64')
    expect(classes).not.toContain('xl:h-[4.5rem]')
    expect(classes).toContain('w-full')
    expect(classes).toContain('rounded-[var(--vc-radius)]')
  })
})
