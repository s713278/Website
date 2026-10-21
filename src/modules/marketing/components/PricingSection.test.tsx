// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  formatPlanPrice,
  starterFeatureGroups,
  starterIncludedFeatureNames,
  starterPlan,
} from '@/modules/marketing/lib/pricing-plans'
import { DESKTOP_QUERY, STAGE_QUERY } from '@/modules/marketing/lib/pricing-scroll'
import { PricingSection } from './PricingSection'

afterEach(cleanup)

function renderPricing() {
  return render(
    <MemoryRouter>
      <PricingSection />
    </MemoryRouter>,
  )
}

describe('PricingSection', () => {
  it('renders the plan card before the four feature cards, in data order', () => {
    renderPricing()
    const [cta] = screen.getAllByRole('link', { name: starterPlan.cta })
    expect(cta.getAttribute('href')).toBe('/onboarding')
    const featureHeadings = screen.getAllByRole('heading', { level: 4 })
    expect(featureHeadings.map((h) => h.textContent)).toEqual(starterFeatureGroups.map((g) => g.title))
    expect(cta.compareDocumentPosition(featureHeadings[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders every Starter feature line exactly once', () => {
    renderPricing()
    for (const name of starterIncludedFeatureNames()) {
      expect(screen.getAllByText(name)).toHaveLength(1)
    }
  })

  it('keeps the section anchor and copy', () => {
    const { container } = renderPricing()
    const section = container.querySelector('section#pricing')
    expect(section).not.toBeNull()
    expect(section?.classList.contains('scroll-mt-24')).toBe(true)
    expect(screen.getByText('Everything you need to start selling online')).toBeTruthy()
    expect(
      screen.getByText('Share your store with customers and manage your products and orders in one place.'),
    ).toBeTruthy()
    expect(screen.getByText(/charges no commission on sales/)).toBeTruthy()
  })

  it('renders no indexing UI', () => {
    renderPricing()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText(/\b[1-4]\s*\/\s*4\b/)).toBeNull()
  })

  it('uses the official channel marks in the Share and take orders art', () => {
    const { container } = renderPricing()
    const channelArt = container.querySelector('[data-pricing-card]:nth-of-type(2) > [aria-hidden="true"]')
    expect(channelArt?.querySelectorAll('svg').length).toBeGreaterThanOrEqual(3)
  })

  it('places the footnote after the last feature card', () => {
    const { container } = renderPricing()
    const cards = container.querySelectorAll('[data-pricing-card]')
    const footnote = container.querySelector('[data-pricing-footnote]')
    expect(cards).toHaveLength(4)
    expect(footnote).not.toBeNull()
    expect(cards[3].compareDocumentPosition(footnote!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps every feature card readable without the stage', () => {
    const { container } = renderPricing()
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-pricing-card]'))
    expect(cards).toHaveLength(4)
    for (const card of cards) {
      expect(card.hasAttribute('inert')).toBe(false)
      expect(card.hasAttribute('aria-hidden')).toBe(false)
      expect(card.style.opacity).toBe('')
      expect(card.hasAttribute('data-state')).toBe(false)
    }
  })
})

type ChangeListener = (event: { matches: boolean }) => void

function stubStageEnvironment(matches: Record<string, boolean>) {
  const listeners = new Map<string, Set<ChangeListener>>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return matches[query] ?? false
    },
    addEventListener: (type: string, listener: ChangeListener) => {
      if (type !== 'change') return
      if (!listeners.has(query)) listeners.set(query, new Set())
      listeners.get(query)!.add(listener)
    },
    removeEventListener: (type: string, listener: ChangeListener) => {
      if (type === 'change') listeners.get(query)?.delete(listener)
    },
  }))
  class NoopObserver {
    callback: unknown
    constructor(callback: unknown) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  const resizeCallbacks: Array<() => void> = []
  class CapturingResizeObserver extends NoopObserver {
    constructor(callback: () => void) {
      super(callback)
      resizeCallbacks.push(callback)
    }
  }
  vi.stubGlobal('ResizeObserver', CapturingResizeObserver)
  vi.stubGlobal('IntersectionObserver', NoopObserver)
  const addListener = vi.spyOn(window, 'addEventListener')

  function fireChange(query: string, nextMatches: boolean) {
    matches[query] = nextMatches
    act(() => {
      for (const listener of listeners.get(query) ?? []) listener({ matches: nextMatches })
    })
  }
  function changeListenerCount() {
    let count = 0
    for (const set of listeners.values()) count += set.size
    return count
  }
  function fireResize() {
    act(() => {
      for (const callback of resizeCallbacks) callback()
    })
  }
  return { addListener, fireChange, fireResize, changeListenerCount }
}

/**
 * Stubs layout heights: the heading block is `heights.head` (80 unless given), the plan card is
 * `heights.plan`, card n is `heights.cards[n]`.
 */
function stubHeights(heights: { head?: number; plan: number; cards: number[] }) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('data-pricing-head')) return heights.head ?? 80
    if (this.hasAttribute('data-pricing-plan')) return heights.plan
    if (this.hasAttribute('data-pricing-card')) {
      const cards = Array.from(this.parentElement!.children)
      return heights.cards[cards.indexOf(this)] ?? 0
    }
    return 0
  })
}

function stageParts(container: HTMLElement) {
  const section = container.querySelector<HTMLElement>('section#pricing')!
  return {
    section,
    stage: () => section.dataset.pricingStage,
    headHeight: () => section.style.getPropertyValue('--pricing-head-h'),
    cardHeight: () => section.style.getPropertyValue('--pricing-card-h'),
    planHeight: () => section.style.getPropertyValue('--pricing-plan-h'),
  }
}

describe('PricingSection deck', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('leaves the section static when reduced motion is requested', async () => {
    stubStageEnvironment({ [STAGE_QUERY]: false, [DESKTOP_QUERY]: true })
    stubHeights({ plan: 540, cards: [420, 400, 410, 400] })
    const { section, cardHeight } = stageParts(renderPricing().container)
    await waitFor(() => {
      expect(section.hasAttribute('data-pricing-stage')).toBe(false)
      expect(cardHeight()).toBe('')
    })
  })

  it('measures the heading, the tallest card and the plan card on mount, without a scroll listener', async () => {
    const { addListener } = stubStageEnvironment({ [STAGE_QUERY]: true, [DESKTOP_QUERY]: true })
    stubHeights({ head: 82, plan: 540, cards: [420, 460, 410, 400] })
    const { stage, headHeight, cardHeight, planHeight } = stageParts(renderPricing().container)
    await waitFor(() => expect(stage()).toBe('desktop'))
    expect(headHeight()).toBe('82px')
    expect(cardHeight()).toBe('460px')
    expect(planHeight()).toBe('540px')
    expect(addListener.mock.calls.some(([type]) => type === 'scroll')).toBe(false)
  })

  it('re-measures when the cards or plan card resize, up and down', async () => {
    const env = stubStageEnvironment({ [STAGE_QUERY]: true, [DESKTOP_QUERY]: true })
    const heights = { plan: 540, cards: [420, 420, 420, 420] }
    stubHeights(heights)
    const { cardHeight, planHeight } = stageParts(renderPricing().container)
    await waitFor(() => expect(cardHeight()).toBe('420px'))
    heights.plan = 620
    heights.cards = [480, 420, 420, 420]
    env.fireResize()
    expect(cardHeight()).toBe('480px')
    expect(planHeight()).toBe('620px')
    heights.plan = 500
    heights.cards = [380, 390, 370, 360]
    env.fireResize()
    expect(cardHeight()).toBe('390px')
    expect(planHeight()).toBe('500px')
  })

  it('measures only the cards on tablet', async () => {
    const env = stubStageEnvironment({ [STAGE_QUERY]: true, [DESKTOP_QUERY]: true })
    stubHeights({ plan: 540, cards: [420, 460, 410, 400] })
    const { stage, cardHeight, planHeight } = stageParts(renderPricing().container)
    await waitFor(() => expect(planHeight()).toBe('540px'))
    env.fireChange(DESKTOP_QUERY, false)
    expect(stage()).toBe('tablet')
    expect(cardHeight()).toBe('460px')
    expect(planHeight()).toBe('')
  })

  it('leaves deck mode and clears what it wrote when the stage query stops matching', async () => {
    const env = stubStageEnvironment({ [STAGE_QUERY]: true, [DESKTOP_QUERY]: true })
    stubHeights({ plan: 540, cards: [420, 460, 410, 400] })
    const { section, headHeight, cardHeight, planHeight } = stageParts(renderPricing().container)
    await waitFor(() => expect(cardHeight()).toBe('460px'))
    env.fireChange(STAGE_QUERY, false)
    expect(section.hasAttribute('data-pricing-stage')).toBe(false)
    expect(headHeight()).toBe('')
    expect(cardHeight()).toBe('')
    expect(planHeight()).toBe('')
  })

  it('re-enters deck mode when the stage query matches again', async () => {
    const env = stubStageEnvironment({ [STAGE_QUERY]: true, [DESKTOP_QUERY]: true })
    stubHeights({ plan: 540, cards: [420, 460, 410, 400] })
    const { stage, cardHeight } = stageParts(renderPricing().container)
    await waitFor(() => expect(stage()).toBe('desktop'))
    env.fireChange(STAGE_QUERY, false)
    env.fireChange(STAGE_QUERY, true)
    expect(stage()).toBe('desktop')
    expect(cardHeight()).toBe('460px')
  })

  it('removes its listeners and variables on unmount', async () => {
    const env = stubStageEnvironment({ [STAGE_QUERY]: true, [DESKTOP_QUERY]: true })
    stubHeights({ plan: 540, cards: [420, 460, 410, 400] })
    const { container, unmount } = renderPricing()
    const { section, stage, cardHeight } = stageParts(container)
    await waitFor(() => expect(stage()).toBe('desktop'))
    unmount()
    expect(section.hasAttribute('data-pricing-stage')).toBe(false)
    expect(cardHeight()).toBe('')
    expect(env.changeListenerCount()).toBe(0)
  })
})

type IntersectionCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void

function stubIntersectionObserver() {
  const instances: Array<{ callback: IntersectionCallback; targets: Element[]; disconnected: boolean }> = []
  class CapturingObserver {
    instance: { callback: IntersectionCallback; targets: Element[]; disconnected: boolean }
    constructor(callback: IntersectionCallback) {
      this.instance = { callback, targets: [], disconnected: false }
      instances.push(this.instance)
    }
    observe(target: Element) {
      this.instance.targets.push(target)
    }
    unobserve() {}
    disconnect() {
      this.instance.disconnected = true
    }
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', CapturingObserver)

  /** Reports the given targets as changed; the hook reads the live rects itself. */
  function fire(targets: Element[], viewportHeight: number) {
    const instance = instances.at(-1)!
    act(() => {
      instance.callback(
        targets.map((target) => ({ target, rootBounds: { height: viewportHeight } as DOMRectReadOnly })),
      )
    })
  }
  return { fire, instances }
}

/** Stubs live layout for the plan card and footnote; returns a setter for the next frame. */
function stubBarGeometry(container: HTMLElement) {
  const plan = container.querySelector<HTMLElement>('[data-pricing-plan]')!
  const footnote = container.querySelector<HTMLElement>('[data-pricing-footnote]')!
  const geometry = { planBottom: 1500, footnoteTop: 4000 }
  vi.spyOn(plan, 'getBoundingClientRect').mockImplementation(
    () => ({ top: geometry.planBottom - 600, bottom: geometry.planBottom }) as DOMRect,
  )
  vi.spyOn(footnote, 'getBoundingClientRect').mockImplementation(
    () => ({ top: geometry.footnoteTop, bottom: geometry.footnoteTop + 60 }) as DOMRect,
  )
  function set(next: { planBottom: number; footnoteTop: number }) {
    Object.assign(geometry, next)
  }
  return { plan, footnote, set }
}

function expectBarHidden(bar: HTMLElement, hidden: boolean) {
  expect(bar.hasAttribute('inert')).toBe(hidden)
  expect(bar.classList.contains('invisible')).toBe(hidden)
  expect(bar.classList.contains('translate-y-full')).toBe(hidden)
}

describe('PricingSection plan bar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the bar inert until the plan card has scrolled away', async () => {
    const io = stubIntersectionObserver()
    const { container, unmount } = renderPricing()
    const bar = container.querySelector<HTMLElement>('[data-pricing-bar]')!
    const geometry = stubBarGeometry(container)
    expectBarHidden(bar, true)
    geometry.set({ planBottom: -10, footnoteTop: 2000 })
    io.fire([geometry.plan, geometry.footnote], 844)
    await waitFor(() => expectBarHidden(bar, false))
    geometry.set({ planBottom: -1400, footnoteTop: 600 })
    io.fire([geometry.footnote], 844)
    await waitFor(() => expectBarHidden(bar, true))
    unmount()
    expect(io.instances.at(-1)!.disconnected).toBe(true)
  })

  it('derives each callback from live layout, not the reported targets', async () => {
    const io = stubIntersectionObserver()
    const { container } = renderPricing()
    const bar = container.querySelector<HTMLElement>('[data-pricing-bar]')!
    const section = container.querySelector('section#pricing')!
    const geometry = stubBarGeometry(container)
    expect(io.instances.at(-1)!.targets).toEqual([section, geometry.plan, geometry.footnote])
    geometry.set({ planBottom: -10, footnoteTop: 2000 })
    io.fire([geometry.plan], 844)
    await waitFor(() => expectBarHidden(bar, false))
    io.fire([geometry.footnote], 844)
    await waitFor(() => expectBarHidden(bar, false))
    // Home key: the plan card jumps from above to below the viewport without ever intersecting.
    geometry.set({ planBottom: 1500, footnoteTop: 4000 })
    io.fire([section], 844)
    await waitFor(() => expectBarHidden(bar, true))
  })

  it('shows the plan summary from existing plan data', () => {
    const { container } = renderPricing()
    const bar = within(container.querySelector<HTMLElement>('[data-pricing-bar]')!)
    expect(bar.getByText(formatPlanPrice(starterPlan.price))).toBeTruthy()
    expect(bar.getByText('/month · 14 days free to try')).toBeTruthy()
    expect(bar.getByRole('link', { name: starterPlan.cta, hidden: true }).getAttribute('href')).toBe('/onboarding')
  })

  it('renders the bar after the footnote in DOM order', () => {
    const { container } = renderPricing()
    const footnote = container.querySelector('[data-pricing-footnote]')!
    const bar = container.querySelector('[data-pricing-bar]')!
    expect(footnote.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('drops the duplicate below-desktop CTA', () => {
    renderPricing()
    const links = screen.getAllByRole('link', { name: starterPlan.cta, hidden: true })
    expect(links).toHaveLength(2)
    expect(links[0].closest('[data-pricing-plan]')).not.toBeNull()
    expect(links[1].closest('[data-pricing-bar]')).not.toBeNull()
  })
})
