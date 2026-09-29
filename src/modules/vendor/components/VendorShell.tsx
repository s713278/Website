import { lazy, Suspense, useEffect, useState } from 'react'
import {
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  Share2,
  X,
} from 'lucide-react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import logoDarkMd from '@/assets/logo_dark_md.png'
import { LiveHeaderButton, LiveShellBanner } from '@/modules/vendor/components/LiveBillingChrome'
import { VendorAccountProvider } from '@/modules/vendor/components/VendorAccountProvider'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { useStartedLiveBilling } from '@/modules/vendor/store/live-billing'
import { isLiveApi } from '@/shared/api'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/**
 * The six surfaces of the console, in the order a vendor works through them.
 *
 * The first four and their labels are the shared design's, from
 * `design-reference/dashboard.html` — including "Store & Share", which says what that
 * screen is for where "Storefront" only said what it showed. Plan is the sixth: the
 * reference predates it, and it is one of the three surfaces v1 must carry.
 *
 * `short` is the bottom bar's label. A tab strip four across on a 390px screen has room
 * for one word.
 */
const NAV = [
  { to: '/vendor', label: 'Overview', short: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/vendor/orders', label: 'Orders', short: 'Orders', icon: ClipboardList, end: false },
  { to: '/vendor/products', label: 'Products', short: 'Products', icon: Package, end: false },
  { to: '/vendor/storefront', label: 'Store & Share', short: 'Share', icon: Share2, end: false },
  { to: '/vendor/plan', label: 'Plan', short: 'Plan', icon: Gauge, end: false },
  { to: '/vendor/settings', label: 'Settings', short: 'Settings', icon: Settings, end: false },
]

/**
 * Four on the phone, six in the rail.
 *
 * Six tabs on a bottom bar leaves each one too narrow to hit. The two that come out are the
 * two a vendor working the counter reaches for least, and neither is stranded: the rail is
 * a tap away behind the menu button at every width.
 */
const MOBILE_NAV = NAV.slice(0, 4)

/**
 * What the top bar calls the screen below it.
 *
 * Read off the path rather than announced by each page, so the title cannot arrive a frame
 * after the surface it names, and no page has to remember to declare one.
 *
 * The order id is matched here rather than taken from `useParams`, which in a parent route
 * element returns only that route's own params — `:orderId` belongs to a child and never
 * reaches this component. The static subscriptions path is tested first, exactly as the
 * router orders those two routes.
 */
function pageTitle(pathname: string): string {
  if (pathname === '/vendor' || pathname === '/vendor/') return 'Overview'
  if (pathname.startsWith('/vendor/orders/subscriptions')) return 'Subscriptions'
  const order = /^\/vendor\/orders\/([^/]+)\/?$/.exec(pathname)
  if (order) return `Order #${order[1]}`
  if (pathname.startsWith('/vendor/orders')) return 'Orders'
  if (pathname.startsWith('/vendor/products')) return 'Products'
  if (pathname.startsWith('/vendor/storefront')) return 'Store & Share'
  if (pathname.startsWith('/vendor/plan')) return 'Plan'
  if (pathname.startsWith('/vendor/settings')) return 'Settings'
  return 'Overview'
}

/**
 * The rail's active marker: an emerald wash and a rule down its left edge.
 *
 * The wash is the shared design's, and it replaces the neutral fill an earlier pass used.
 * The ink on it is `--vc-tint-ink` rather than the reference's own darkened brand green —
 * see the token's note in `global.css` for why that shade moved.
 */
function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
    isActive
      ? 'bg-[var(--vc-tint)] text-[var(--vc-tint-ink)] shadow-[inset_3px_0_0_var(--md-green-500)]'
      : 'text-slate-600 hover:bg-[var(--vc-tint)] hover:text-[var(--vc-tint-ink)]',
  )
}

function bottomLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[0.7rem] font-bold transition',
    isActive ? 'bg-[var(--vc-tint)] text-[var(--vc-tint-ink)]' : 'text-slate-500',
  )
}

/**
 * The rail head: the real lockup, the same asset the marketing header uses, and one line
 * saying which of MithraDirect's consoles this is.
 */
function BrandMark() {
  return (
    <div className="px-2 pt-1 pb-2">
      <Link to="/" aria-label="Mithra Direct home">
        <img
          src={logoDarkMd}
          alt="Mithra Direct — Shop Local, Support Local, Grow Together"
          className="h-8 w-auto"
        />
      </Link>
      <p className="mt-1.5 text-xs font-semibold tracking-wide text-[var(--md-muted)]">
        Vendor dashboard
      </p>
    </div>
  )
}

/**
 * The rail's foot: which plan the store is on, and the way out to the customer view.
 *
 * The chip is withheld rather than guessed at when no plan name has loaded — a chip
 * reading "Free plan" on a store whose plan never loaded is the one mistake this corner
 * can make. Demo reads its context's plan; the live API reads the subscription.
 */
function RailFoot() {
  const { context, plan, storeState } = useVendorAccount()
  const identifier = context.storeIdentifier
  const isOpen = storeState === 'OPEN'

  return (
    <div className="mt-auto grid gap-2.5 border-t border-[var(--vc-edge)] px-2 pt-3">
      {isLiveApi() ? <LivePlanChip /> : plan.name ? <PlanChip name={plan.name} /> : null}

      {isOpen && identifier ? (
        <Link to={`/stores/${identifier}`}>
          <Button variant="outline" size="sm" fullWidth className="rounded-full">
            View storefront
          </Button>
        </Link>
      ) : (
        <Link to="/onboarding">
          <Button variant="outline" size="sm" fullWidth className="rounded-full">
            Finish setup
          </Button>
        </Link>
      )}
    </div>
  )
}

function PlanChip({ name }: { name: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--vc-tint-line)] bg-[var(--vc-tint)] px-2.5 py-1 text-xs font-bold text-[var(--vc-tint-ink)]">
      <span className="size-1.5 rounded-full bg-[var(--md-green-500)]" aria-hidden />
      {name} plan
    </span>
  )
}

/**
 * The live API's chip names the plan from the subscription read the chrome shares, because the
 * vendor context no longer carries it. It is withheld before go-live, while the first read loads
 * and after it fails.
 */
function LivePlanChip() {
  const { vendorId } = useVendorAccount()
  const { planName } = useStartedLiveBilling(vendorId)
  return planName ? <PlanChip name={planName} /> : null
}

/**
 * The plan banner, under the top bar on every surface.
 *
 * Shown only to an open store on the free plan, because that is the only vendor both
 * halves of it are true for: a store that is not open has no shop link to share, and a
 * store on a paid plan is not being told what the free one includes.
 */
function PlanBanner() {
  const { plan, storeState } = useVendorAccount()
  if (storeState !== 'OPEN' || plan.code !== 'FREE' || !plan.name) return null

  return (
    <div
      role="status"
      className="mx-[var(--vc-gutter)] mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-[var(--vc-radius)] border border-[var(--vc-tint-line)] bg-[image:var(--vc-banner)] px-4 py-3 text-sm text-slate-700"
    >
      <p>
        <strong className="font-semibold">{plan.name} plan active</strong> — share your shop link
        to get your first WhatsApp orders.
      </p>
      <Link
        to="/vendor/storefront"
        className="rounded-full border border-[var(--vc-tint-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--vc-tint-ink)] transition hover:bg-[var(--vc-tint)]"
      >
        Share store link
      </Link>
    </div>
  )
}

/**
 * The six-state Plan prototype's banner and header button: local development in demo mode only.
 *
 * They read the prototype state Plan shares, and link to Plan rather than opening Checkout. A
 * production build drops the import entirely and keeps the plan pill and `PlanBanner`; the live API
 * has its own billing chrome.
 */
const prototypeChrome = import.meta.env.DEV ? () => import('@/modules/vendor/components/BillingPrototypeChrome') : null
const PrototypeShellBanner = prototypeChrome && lazy(() => prototypeChrome().then((module) => ({ default: module.PrototypeShellBanner })))
const PrototypeHeaderButton = prototypeChrome && lazy(() => prototypeChrome().then((module) => ({ default: module.PrototypeHeaderButton })))

/**
 * The console frame.
 *
 * Full-bleed rather than a centred column: a console occupies the window, and it is the
 * content inside that carries a measure. One 3px emerald rule runs across the head of both
 * columns, and both are sticky, so it stays on screen as the brand's signature on the
 * surface a vendor spends their working day in.
 *
 * The rail becomes an off-canvas drawer below `lg` rather than `md`: at 1024px a
 * 15.5rem rail leaves the orders table under 730px and every cell in it wraps.
 */
function VendorChrome() {
  const { context } = useVendorAccount()
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const title = pageTitle(pathname)
  const live = isLiveApi()

  // Arriving somewhere is what closing the drawer means, so the route is what closes it —
  // not each link having to remember to.
  useEffect(() => setNavOpen(false), [pathname])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className="vendor-console min-h-screen lg:grid lg:grid-cols-[var(--vc-rail)_1fr]">
      <aside
        id="vendor-rail"
        aria-label="Vendor navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[min(17rem,86vw)] flex-col gap-3 border-t-[3px] border-r border-t-[var(--md-green-500)] border-r-[var(--vc-edge)] bg-[var(--vc-rail-bg)] px-3 py-4 shadow-[0_24px_48px_rgba(6,78,59,0.14)] transition-transform duration-200 motion-reduce:transition-none',
          navOpen ? 'translate-x-0' : '-translate-x-[105%]',
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <BrandMark />
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="mt-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-[var(--md-ink)] lg:hidden"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="grid gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
              <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <RailFoot />
      </aside>

      {/* Only ever hit-testable while the drawer is open; the rail at `lg` has no overlay. */}
      {navOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-col pb-24 lg:pb-8">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-t-[3px] border-b border-t-[var(--md-green-500)] border-b-[var(--vc-edge)] bg-[var(--vc-bar-bg)] px-[var(--vc-gutter)] py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={navOpen}
            aria-controls="vendor-rail"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--vc-edge)] bg-white text-[var(--md-ink)] transition hover:bg-slate-50 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            {/*
              The one `h1` on every console screen. A page that set its own would compete
              with this for the document outline, so the surfaces below carry `h2`s.
            */}
            <h1 className="font-display truncate text-xl font-bold">{title}</h1>
            <p className="truncate text-xs text-[var(--md-muted)]">
              {context.businessName ?? 'Your store'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/onboarding"
              className="hidden text-sm font-semibold text-[var(--md-muted)] transition hover:text-[var(--vc-tint-ink)] sm:block"
            >
              Setup
            </Link>
            {/*
              The reference's top-right pill points at marketing pricing and says "Upgrade".
              Neither is available here: `GET /v1/api/subscription-plans` answers 403 on a
              vendor token and pricing is undecided, so every tier but the current one would
              be invented. The pill keeps its place and says where it actually goes. With the
              live API it names the billing state's next step instead, and still links to Plan.
            */}
            {live ? (
              <LiveHeaderButton />
            ) : PrototypeHeaderButton ? (
              <Suspense fallback={null}>
                <PrototypeHeaderButton />
              </Suspense>
            ) : (
              <Link to="/vendor/plan">
                <Button size="sm" className="rounded-full">
                  Your plan
                </Button>
              </Link>
            )}
          </div>
        </header>

        {live ? (
          <LiveShellBanner planBanner={<PlanBanner />} />
        ) : PrototypeShellBanner ? (
          <Suspense fallback={null}>
            <PrototypeShellBanner />
          </Suspense>
        ) : (
          <PlanBanner />
        )}

        <main className="flex-1 px-[var(--vc-gutter)] pt-4 pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom bar on small screens: a vendor working the counter is on a phone. */}
      {/*
        Below the backdrop, not beside it. At the same stacking level the later element in
        the DOM wins, which left this bar bright and tappable over a dimmed page whenever
        the drawer was open.

        The bottom inset keeps the four labels clear of a home indicator.
      */}
      <nav
        aria-label="Vendor sections"
        className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t border-[var(--vc-edge)] bg-white/95 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        {MOBILE_NAV.map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomLinkClass}>
            <Icon className="size-5" aria-hidden />
            {short}
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
