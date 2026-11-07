/* The looping "new order" feed behind the hero's phone preview.

   It is a tiny external store rather than React state so one timer drives everything and only
   the two subscribers (the toast stack and the cart badge) re-render on a tick; the hero around
   them never does. Order data is a fixed pool walked in order, so the loop is deterministic. */

export interface HeroOrder {
  /** Monotonic, so a toast keeps its DOM node (and its CSS transition) as it moves down. */
  id: number
  name: string
  amount: number
}

export interface HeroOrderFeedState {
  /** Newest first. */
  orders: readonly HeroOrder[]
  cartCount: number
}

export const HERO_ORDER_INTERVAL_MS = 2400
/** Toasts a visitor can see at once. */
export const HERO_ORDER_VISIBLE = 3
/** One extra slot keeps the oldest toast mounted while it fades out, so no second timer is needed. */
export const HERO_ORDER_SLOTS = HERO_ORDER_VISIBLE + 1

const CART_BASE = 2
const CART_STEPS = 3

export const heroOrderPool: readonly Omit<HeroOrder, 'id'>[] = [
  { name: 'Priya', amount: 246 },
  { name: 'Arjun', amount: 412 },
  { name: 'Meera', amount: 178 },
  { name: 'Karthik', amount: 530 },
  { name: 'Ananya', amount: 96 },
  { name: 'Rohan', amount: 324 },
  { name: 'Divya', amount: 209 },
  { name: 'Suresh', amount: 387 },
]

function orderAt(tick: number): HeroOrder {
  return { id: tick, ...heroOrderPool[tick % heroOrderPool.length] }
}

export function createHeroOrderFeed() {
  let tick = 0
  let state: HeroOrderFeedState = { orders: [orderAt(0)], cartCount: CART_BASE }
  let timer: ReturnType<typeof setInterval> | undefined
  const listeners = new Set<() => void>()

  function advance() {
    tick += 1
    state = {
      orders: [orderAt(tick), ...state.orders].slice(0, HERO_ORDER_SLOTS),
      cartCount: CART_BASE + (tick % CART_STEPS),
    }
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    start() {
      if (timer === undefined) timer = setInterval(advance, HERO_ORDER_INTERVAL_MS)
    },
    stop() {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
    },
  }
}

export type HeroOrderFeed = ReturnType<typeof createHeroOrderFeed>
