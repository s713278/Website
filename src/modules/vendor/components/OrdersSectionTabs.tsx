import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'

/**
 * The two list surfaces owned by Orders; neither is a seventh rail destination.
 *
 * Chips rather than an underlined tab strip, so the console has one vocabulary for "pick
 * one of these" — the same shape the filters inside each list use. The difference is
 * position: these sit above the panel and switch which panel you are looking at.
 */
function tabClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
    isActive
      ? 'bg-[var(--vc-tint)] text-[var(--vc-tint-ink)] shadow-[inset_0_0_0_1px_var(--vc-tint-line)]'
      : 'text-slate-500 hover:bg-white hover:text-[var(--md-ink)]',
  )
}

export function OrdersSectionTabs() {
  return (
    <nav aria-label="Orders sections" className="flex gap-1">
      <NavLink to="/vendor/orders" end className={tabClass}>
        Orders
      </NavLink>
      <NavLink to="/vendor/orders/subscriptions" end className={tabClass}>
        Subscriptions
      </NavLink>
    </nav>
  )
}
