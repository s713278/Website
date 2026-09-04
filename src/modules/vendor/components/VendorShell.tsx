import { LayoutDashboard, ClipboardList, Package, Settings, Store } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { VendorAccountProvider } from '@/modules/vendor/components/VendorAccountProvider'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { presentStoreState } from '@/modules/vendor/lib/store-state'
import { Badge } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

const NAV = [
  { to: '/vendor', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/vendor/orders', label: 'Orders', icon: ClipboardList, end: false },
  { to: '/vendor/products', label: 'Products', icon: Package, end: false },
  { to: '/vendor/storefront', label: 'Storefront', icon: Store, end: false },
  { to: '/vendor/settings', label: 'Settings', icon: Settings, end: false },
]

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-[var(--md-green-50)] text-[var(--md-green-800)]'
      : 'text-slate-600 hover:bg-slate-100',
  )
}

function bottomLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition',
    isActive ? 'text-[var(--md-green-700)]' : 'text-slate-500',
  )
}

/** The plan a vendor is on, with what they have used against what it allows. */
function PlanSummary() {
  const { plan } = useVendorAccount()
  const products = plan.usage.products
  const limit = plan.limits.products

  return (
    <div className="rounded-lg border border-[var(--md-border)] bg-white p-3">
      <p className="text-xs font-semibold text-slate-700">{plan.name ?? plan.tier ?? 'Your plan'}</p>
      {products != null && limit != null ? (
        <p className="mt-1 text-xs text-[var(--md-muted)]">
          {products} of {limit} products used
        </p>
      ) : null}
      {/*
        A trial countdown appears here only when the backend sends an end date. No
        deployed response carries one yet, so nothing is shown rather than a deadline
        computed from a hardcoded trial length.
      */}
      {plan.trialEndsAt ? (
        <p className="mt-1 text-xs text-[var(--md-muted)]">
          Trial ends {new Date(plan.trialEndsAt).toLocaleDateString()}
        </p>
      ) : null}
    </div>
  )
}

function StoreHeading() {
  const { context, storeState } = useVendorAccount()
  const presentation = presentStoreState(storeState)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="font-display text-lg font-bold text-[var(--md-green-800)]">
        {context.businessName ?? 'Your store'}
      </h1>
      <Badge tone={presentation.tone}>{presentation.label}</Badge>
    </div>
  )
}

function VendorChrome() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4">
        <aside className="hidden w-56 shrink-0 flex-col gap-4 md:flex">
          <NavLink to="/" className="font-display text-lg font-bold text-[var(--md-green-700)]">
            MithraDirect
          </NavLink>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <PlanSummary />
        </aside>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <header className="mb-5 border-b border-[var(--md-border)] pb-4">
            <StoreHeading />
          </header>
          <Outlet />
        </main>
      </div>

      {/* Bottom bar on small screens: a vendor working the counter is on a phone. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--md-border)] bg-white/95 backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomLinkClass}>
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/**
 * The vendor dashboard shell.
 *
 * Deliberately outside `RootLayout`: a vendor running their store has no use for the
 * customer header's store search and cart, and the old arrangement stacked that chrome on
 * top of a tab strip.
 */
export function VendorShell() {
  return (
    <VendorAccountProvider>
      <VendorChrome />
    </VendorAccountProvider>
  )
}
