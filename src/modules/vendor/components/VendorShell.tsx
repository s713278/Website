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
import logoDarkMd from '@/assets/logo_dark_md.png'
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

/**
 * The rail's active marker is a rule, not a wash.
 *
 * Emerald in this console means "the next thing to do". Filling the active entry with it
 * would spend the action colour on a label that says where you already are, so the fill is
 * neutral and a single emerald rule marks the position.
 */
function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'relative flex items-center gap-3 rounded-md py-2 pr-2 pl-3 text-sm transition',
    'before:absolute before:top-1/2 before:left-0 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full',
    isActive
      ? 'bg-slate-100 font-semibold text-[var(--md-ink)] before:bg-[var(--md-green-600)]'
      : 'font-medium text-slate-600 before:bg-transparent hover:bg-slate-50 hover:text-[var(--md-ink)]',
  )
}

function bottomLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition',
    isActive ? 'text-[var(--md-green-700)]' : 'text-slate-500',
  )
}

/**
 * The brand mark, at the head of the rail.
 *
 * The real lockup, the same asset the marketing header uses — the console previously set the
 * name as Poppins text, which is a different mark from the one on every other surface.
 *
 * Desktop only, deliberately. It is a wide horizontal lockup carrying a tagline, and beside
 * the store name on a 390px bar it has neither the room to be legible nor the room to leave
 * the store name legible. There is no square mark to fall back to: `favicon.svg` is a
 * placeholder, and substituting it would put a mark on screen that is not the brand's.
 */
function BrandMark() {
  return (
    <Link to="/" aria-label="Mithra Direct home">
      <img
        src={logoDarkMd}
        alt="Mithra Direct — Shop Local, Support Local, Grow Together"
        className="h-9 w-auto"
      />
    </Link>
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
      {/*
        The negative margin cancels the trigger's own padding, so the store name sits on the
        same left edge as the page title below it rather than 8px inside it.
      */}
      <DropdownMenuTrigger className="-ml-2 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition outline-none hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="font-display truncate text-base font-semibold text-[var(--md-ink)]">
          {storeName}
        </span>
        <Badge tone={presentation.tone}>{presentation.label}</Badge>
        <ChevronDown className="size-4 shrink-0 text-slate-500" aria-hidden />
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
 * It sits in the main column rather than the rail because the rail is hidden below `md`,
 * and a walkthrough given on a phone needs the switcher as much as one given on a laptop.
 */
function DemoStateSwitcher() {
  const { demo } = useVendorAccount()
  if (!demo) return null

  return (
    <div className="mt-8 rounded-xl border border-dashed border-[var(--vc-edge)] bg-[var(--vc-panel)] p-4">
      <p className="text-sm font-semibold text-slate-700">Demo: store state</p>
      <p className="mt-0.5 text-xs text-[var(--md-muted)]">Not shown on a live account.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {demoService.storeStateKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => demo.select(key)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition',
              demo.storeState === key
                ? 'border-[var(--md-green-600)] bg-[var(--md-green-50)] font-medium text-[var(--md-green-800)]'
                : 'border-[var(--vc-edge)] text-slate-600 hover:bg-slate-50',
            )}
          >
            {DEMO_STATE_LABELS[key] ?? key}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The console frame.
 *
 * Full-bleed rather than a centred column: a console occupies the window, and it is the
 * content inside that carries a measure. The rail head and the top bar share `--vc-bar`
 * and one border, so the brand, the store name and every page title below resolve to the
 * same horizontal across all six surfaces.
 */
function VendorChrome() {
  return (
    <div className="vendor-console flex min-h-screen">
      {/*
        The rail is the stretched flex child and the sticky column lives inside it, not the
        other way round. A sticky `h-screen` aside is only ever one viewport tall, so on
        Orders — the one screen that always scrolls — the white ran out part-way down and
        the canvas showed through beneath the nav.

        The head's `px-5` and the nav's `px-2 pl-3` both land on 20px, so the logo and the
        six icons share one left edge and the active marker sits in the gutter left of it.
      */}
      <aside className="hidden w-[var(--vc-rail)] shrink-0 border-r border-[var(--vc-edge)] bg-[var(--vc-panel)] md:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-[var(--vc-bar)] shrink-0 items-center border-b border-[var(--vc-edge)] px-5">
            <BrandMark />
          </div>
          <nav className="flex flex-col gap-0.5 px-2 py-3">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[var(--vc-bar)] shrink-0 items-center border-b border-[var(--vc-edge)] bg-[var(--vc-panel)] px-[var(--vc-gutter)]">
          <AccountMenu />
        </header>

        <main className="flex-1 px-[var(--vc-gutter)] pt-8 pb-24 md:pb-12">
          <div className="max-w-[72rem]">
            <Outlet />
            <DemoStateSwitcher />
          </div>
        </main>
      </div>

      {/* Bottom bar on small screens: a vendor working the counter is on a phone. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--vc-edge)] bg-white/95 backdrop-blur md:hidden">
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
