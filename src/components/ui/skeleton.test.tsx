// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Skeleton } from './skeleton'

afterEach(cleanup)

describe('Skeleton', () => {
  it('is decorative with the shimmer class and a visible fill', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.classList.contains('md-skeleton')).toBe(true)
    expect(el.classList.contains('bg-foreground/15')).toBe(true)
    expect(el.classList.contains('animate-pulse')).toBe(false)
  })

  it('lets a caller background replace the default fill', () => {
    const { container } = render(<Skeleton className="bg-[var(--x)]" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.classList.contains('bg-[var(--x)]')).toBe(true)
    expect(el.classList.contains('bg-foreground/15')).toBe(false)
    expect(el.classList.contains('md-skeleton')).toBe(true)
  })

  it('lets a caller override aria-hidden', () => {
    const { container } = render(<Skeleton aria-hidden={false} />)
    expect((container.firstElementChild as HTMLElement).getAttribute('aria-hidden')).toBe('false')
  })
})
