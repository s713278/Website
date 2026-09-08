import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'

function tabClass({ isActive }: { isActive: boolean }) {
  return cn(
    'border-b-2 px-1 pb-2 text-sm font-medium transition',
    isActive
      ? 'border-[var(--md-green-600)] text-[var(--md-green-800)]'
      : 'border-transparent text-slate-500 hover:text-[var(--md-ink)]',
  )
}

/** The two list surfaces owned by Orders; neither is a seventh rail destination. */
export function OrdersSectionTabs() {
  return (
    <nav aria-label="Orders sections" className="mb-6 flex gap-6 border-b border-[var(--vc-edge)]">
      <NavLink to="/vendor/orders" end className={tabClass}>
        Orders
      </NavLink>
      <NavLink to="/vendor/orders/subscriptions" end className={tabClass}>
        Subscriptions
      </NavLink>
    </nav>
  )
}
