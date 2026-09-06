import {
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Store,
  Users,
} from 'lucide-react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import { VendorAccountProvider } from '@/modules/vendor/components/VendorAccountProvider'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { presentStoreState } from '@/modules/vendor/lib/store-state'
import { demoService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/** The six surfaces of the console, in the order a vendor works through them. */
const NAV = [
  { to: '/vendor', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/vendor/orders', label: 'Orders', icon: ClipboardList, end: false },
  { to: '/vendor/products', label: 'Products', icon: Package, end: false },
  { to: '/vendor/customers', label: 'Customers', icon: Users, end: false },
  { to: '/vendor/storefront', label: 'Storefront', icon: Store, end: false },
  { to: '/vendor/settings', label: 'Settings', icon: Settings, end: false },
]

/**
 * Five on the phone, six on the desktop.
 *
 * Six tabs on a bottom bar leaves each one too narrow to hit. Settings is the entry a vendor
 * touches least and the one that already has a home in the account menu, so it is the one
 * that comes out — not Customers, which the target console needs visible.
 */
const MOBILE_NAV = NAV.filter((item) => item.to !== '/vendor/settings')

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

/**
 * The store name, doubling as the account menu.
 *
 * Settings left the mobile bar to make room for six surfaces, so it needs somewhere else to
 * live at every width — and log out belongs beside it rather than buried at the foot of the
 * Settings page, where a vendor had to load a screen they did not want in order to leave.
 *
 * Keyboard reachability, outside-click and Escape dismissal come from the Radix primitive;
 * a hand-rolled menu is where those three get forgotten.
 */
function AccountMenu() {
  const { context, storeState } = useVendorAccount()
  const logout = useAuthStore((s) => s.logout)
  const presentation = presentStoreState(storeState)
  const storeName = context.businessName ?? 'Your store'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 text-left transition outline-none hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="font-display text-lg font-bold text-[var(--md-green-800)]">
          {storeName}
        </span>
        <Badge tone={presentation.tone}>{presentation.label}</Badge>
        <ChevronDown className="size-4 text-slate-500" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{storeName}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/vendor/settings">
            <Settings aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOut aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const DEMO_STATE_LABELS: Record<string, string> = {
  SETTING_UP: 'Setting up',
  UNDER_REVIEW: 'Under review',
  OPEN: 'Open',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}

/**
 * Demo-only store-state switcher.
 *
 * Two of the five states — rejected and suspended — cannot be reached on a test account
 * without an administrator acting against a real store, so without this the screens for
 * them could be built and never seen. Absent entirely under a live API: it changes nothing
 * there, and a dead control on a real dashboard invites a support question.
 *
 * It writes the three fields `deriveStoreState` reads, so it cannot show a combination the
 * backend could not produce.
 *
 * It sits in the main column rather than the sidebar because the sidebar is hidden below
 * `md`, and a walkthrough given on a phone needs the switcher as much as one given on a
 * laptop.
 */
function DemoStateSwitcher() {
  const { demo } = useVendorAccount()
  if (!demo) return null

  return (
    <div className="mt-8 rounded-lg border border-dashed border-[var(--md-border)] bg-white p-3">
      <p className="text-xs font-semibold text-slate-700">Demo: store state</p>
      <p className="mt-1 text-[11px] text-[var(--md-muted)]">Not shown on a live account.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {demoService.storeStateKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => demo.select(key)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] transition',
              demo.storeState === key
                ? 'border-[var(--md-green-600)] bg-[var(--md-green-50)] text-[var(--md-green-800)]'
                : 'border-[var(--md-border)] text-slate-600 hover:bg-slate-100',
            )}
          >
            {DEMO_STATE_LABELS[key] ?? key}
          </button>
        ))}
      </div>
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
        </aside>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <header className="mb-5 border-b border-[var(--md-border)] pb-4">
            <AccountMenu />
          </header>
          <Outlet />
          <DemoStateSwitcher />
        </main>
      </div>

      {/* Bottom bar on small screens: a vendor working the counter is on a phone. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--md-border)] bg-white/95 backdrop-blur md:hidden">
        {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
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
