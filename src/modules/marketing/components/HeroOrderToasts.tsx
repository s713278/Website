import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'
import type { HeroOrderFeed } from '@/modules/marketing/lib/hero-order-feed'

function useHeroOrderFeed(feed: HeroOrderFeed) {
  return useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot)
}

/* The feed only runs while the stack can be seen: off-screen or in a background tab it is
   stopped, so the hero costs nothing then. Under reduced motion it never starts and the first
   order stays put as a still toast. */
function useRunWhileVisible(feed: HeroOrderFeed, target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let inView = true
    const sync = () => (inView && !document.hidden ? feed.start() : feed.stop())
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      sync()
    })
    observer.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      feed.stop()
    }
  }, [feed, target])
}

/* Decorative, so hidden from assistive tech: a live region would announce a fake order every
   few seconds. */
export function HeroOrderToasts({ feed }: { feed: HeroOrderFeed }) {
  const { orders } = useHeroOrderFeed(feed)
  const ref = useRef<HTMLDivElement>(null)
  useRunWhileVisible(feed, ref)

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute -right-8 top-[30%] z-20 h-[52px] w-[160px] max-sm:-right-9 max-[23rem]:-right-6 max-sm:-top-3 max-sm:h-11 max-sm:w-[124px] sm:-right-14 lg:-right-24 xl:-right-[7.5rem]"
      aria-hidden
    >
      {orders.map((order, i) => (
        <div
          key={order.id}
          data-slot={i}
          // Only the first toast waits for the phone to settle; later ones land on the beat.
          style={order.id === 0 ? { animationDelay: '1s' } : undefined}
          className="md-order-toast absolute inset-x-0 top-0 flex items-center gap-2.5 rounded-2xl bg-white/90 p-2.5 max-sm:p-2 shadow-[0_18px_40px_-16px_rgba(6,78,59,0.45)] ring-1 ring-slate-900/5 backdrop-blur"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white max-sm:size-7">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-tight text-slate-900">New order</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">
              {order.name} · ₹{order.amount}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* Remounted on each count so its pulse replays with every new order. */
export function HeroCartBadge({ feed }: { feed: HeroOrderFeed }) {
  const { cartCount } = useHeroOrderFeed(feed)
  return (
    <span
      key={cartCount}
      className="md-order-badge absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white"
    >
      {cartCount}
    </span>
  )
}
