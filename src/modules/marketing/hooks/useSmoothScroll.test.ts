// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const lenis = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>>, destroy: vi.fn() }))

vi.mock('lenis', () => ({
  default: class {
    constructor(options: Record<string, unknown>) {
      lenis.options.push(options)
    }
    destroy = lenis.destroy
  },
}))
vi.mock('lenis/dist/lenis.css', () => ({}))

import { useSmoothScroll } from './useSmoothScroll'

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ media: query, matches: reduce }))
}

describe('useSmoothScroll', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    lenis.options.length = 0
    lenis.destroy.mockClear()
    document.body.removeAttribute('data-scroll-locked')
  })

  it('smooths the page with anchors and nested scrollers handled, and stops on unmount', () => {
    stubReducedMotion(false)
    const { unmount } = renderHook(() => useSmoothScroll())
    expect(lenis.options).toHaveLength(1)
    expect(lenis.options[0]).toMatchObject({ autoRaf: true, anchors: true, allowNestedScroll: true })
    unmount()
    expect(lenis.destroy).toHaveBeenCalledTimes(1)
  })

  it('leaves wheel input alone while a dialog holds the scroll lock', () => {
    stubReducedMotion(false)
    renderHook(() => useSmoothScroll())
    const prevent = lenis.options[0].prevent as (node: HTMLElement) => boolean
    expect(prevent(document.body)).toBe(false)
    document.body.setAttribute('data-scroll-locked', '1')
    expect(prevent(document.body)).toBe(true)
  })

  it('keeps native scrolling under a reduced-motion preference', () => {
    stubReducedMotion(true)
    renderHook(() => useSmoothScroll())
    expect(lenis.options).toHaveLength(0)
  })
})
