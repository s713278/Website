import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HERO_ORDER_INTERVAL_MS,
  HERO_ORDER_SLOTS,
  HERO_ORDER_VISIBLE,
  createHeroOrderFeed,
  heroOrderPool,
} from './hero-order-feed'

describe('hero order feed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens with the first order and two items in the cart', () => {
    const feed = createHeroOrderFeed()
    const { orders, cartCount } = feed.getSnapshot()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ name: heroOrderPool[0].name, amount: heroOrderPool[0].amount })
    expect(cartCount).toBe(2)
  })

  it('does not tick until started', () => {
    const feed = createHeroOrderFeed()
    vi.advanceTimersByTime(HERO_ORDER_INTERVAL_MS * 3)
    expect(feed.getSnapshot().orders).toHaveLength(1)
  })

  it('puts each new order first and notifies subscribers once per tick', () => {
    const feed = createHeroOrderFeed()
    const listener = vi.fn()
    feed.subscribe(listener)
    feed.start()

    vi.advanceTimersByTime(HERO_ORDER_INTERVAL_MS)

    const { orders } = feed.getSnapshot()
    expect(orders.map((o) => o.name)).toEqual([heroOrderPool[1].name, heroOrderPool[0].name])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps a bounded number of orders, with unique ids, across a full pool wrap', () => {
    const feed = createHeroOrderFeed()
    feed.start()
    const seen = new Set<number>()

    for (let i = 0; i < heroOrderPool.length * 2 + 1; i += 1) {
      vi.advanceTimersByTime(HERO_ORDER_INTERVAL_MS)
      const { orders } = feed.getSnapshot()
      expect(orders.length).toBeLessThanOrEqual(HERO_ORDER_SLOTS)
      expect(orders[0].id).not.toBeUndefined()
      expect(seen.has(orders[0].id)).toBe(false)
      seen.add(orders[0].id)
    }
    expect(HERO_ORDER_SLOTS).toBe(HERO_ORDER_VISIBLE + 1)
    expect(feed.getSnapshot().orders[0].name).toBe(
      heroOrderPool[(heroOrderPool.length * 2 + 1) % heroOrderPool.length].name,
    )
  })

  it('cycles the cart count through 2, 3, 4 and back', () => {
    const feed = createHeroOrderFeed()
    feed.start()
    const counts = [feed.getSnapshot().cartCount]
    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(HERO_ORDER_INTERVAL_MS)
      counts.push(feed.getSnapshot().cartCount)
    }
    expect(counts).toEqual([2, 3, 4, 2, 3])
  })

  it('stops ticking when stopped and never runs two timers when started twice', () => {
    const feed = createHeroOrderFeed()
    feed.start()
    feed.start()
    vi.advanceTimersByTime(HERO_ORDER_INTERVAL_MS)
    expect(feed.getSnapshot().orders).toHaveLength(2)

    feed.stop()
    vi.advanceTimersByTime(HERO_ORDER_INTERVAL_MS * 5)
    expect(feed.getSnapshot().orders).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns a stable snapshot between ticks', () => {
    const feed = createHeroOrderFeed()
    expect(feed.getSnapshot()).toBe(feed.getSnapshot())
  })

  it('stops notifying an unsubscribed listener', () => {
    const feed = createHeroOrderFeed()
    const listener = vi.fn()
    const unsubscribe = feed.subscribe(listener)
    unsubscribe()
    feed.start()
    vi.advanceTimersByTime(HERO_ORDER_INTERVAL_MS)
    expect(listener).not.toHaveBeenCalled()
  })
})
