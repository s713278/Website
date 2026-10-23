import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
// import { NavLink } from 'react-router-dom' // Restore with the "Stores" nav link below.
import { Menu, X } from 'lucide-react'
import logoDarkMd from '@/assets/logo_dark_md.png'
import { canShopAsCustomer, loginPathForRole, VENDOR_ONBOARDING_HREF } from '@/app/router/role-home'
import { HeaderActionButton } from '@/modules/marketing/components/HeaderActionButton'
import { useHeaderActions } from '@/modules/marketing/hooks/useHeaderActions'
import type { HeaderAction } from '@/modules/marketing/lib/header-actions'
import { canHoldCart } from '@/modules/storefront/lib/cart-nav'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { AccountMenu, CartButton } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

function Brand() {
  return (
    <Link to="/" aria-label="Mithra Direct home">
      {/* At 320px a long cart count can leave the logo short of width; it shrinks without
          stretching instead of pushing the page sideways. */}
      <img
        src={logoDarkMd}
        alt="Mithra Direct — Shop Local, Support Local, Grow Together"
        className="h-10 w-auto object-contain object-left sm:h-11"
      />
    </Link>
  )
}

/** Shopper pages sign in as a customer; Open store is the same onboarding the marketing header offers. */
const SIGNED_OUT_ACTIONS: HeaderAction[] = [
  { label: 'Sign in', to: loginPathForRole('customer'), emphasis: 'secondary' },
  { label: 'Open store', to: VENDOR_ONBOARDING_HREF, emphasis: 'primary' },
]

// Only used by the "Stores" nav link below, hidden for the first production phase.
// function linkClass({ isActive }: { isActive: boolean }) {
//   return cn(
//     'rounded-lg px-3 py-2.5 text-sm font-medium transition',
//     isActive ? 'bg-[var(--md-green-50)] text-[var(--md-green-800)]' : 'text-slate-600 hover:bg-slate-100',
//   )
// }

export function RootLayout() {
  const user = useAuthStore((s) => s.user)
  const cartCount = useCartStore((s) => s.itemCount())
  // Signed in, only a customer session shops here; signed out, only demo carts exist.
  const showCart = user ? canShopAsCustomer(user) : canHoldCart(user)
  // The bar offers at most one account-state action: a vendor's comes from their account, the
  // same as on the marketing header, and a signed-in customer's My orders is in the account menu.
  const vendorHeader = useHeaderActions()
  const actions = !user ? SIGNED_OUT_ACTIONS : user.role === 'vendor' ? vendorHeader.actions : []
  const menuActions = [
    ...actions.filter((action) => action.emphasis === 'primary'),
    ...actions.filter((action) => action.emphasis !== 'primary'),
  ]
  // The menu belongs to the page it was opened on, so following any link in it closes it.
  const { pathname } = useLocation()
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const open = menuOpenOn === pathname
  const closeMenu = () => setMenuOpenOn(null)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-emerald-100/70 bg-white/95 backdrop-blur">
        {/* Below `lg` the actions no longer fit beside the logo, so they move into the menu.
            Stores, the cart and the account menu stay in the bar at every width. */}
        <div className="marketing-gutter">
          <div className="marketing-measure flex h-(--header-height) items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-6">
              <Brand />
              {/* Hidden for the first production phase; /stores stays reachable by URL.
              <nav className="flex items-center gap-1">
                <NavLink to="/stores" className={linkClass} onClick={closeMenu}>Stores</NavLink>
              </nav>
              */}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 lg:flex">
                {actions.map((action) => (
                  <HeaderActionButton key={action.label} action={action} />
                ))}
              </div>
              <AccountMenu storeHref={vendorHeader.storeHref} onSignOut={closeMenu} />
              {showCart && <CartButton to="/cart" count={cartCount} />}
              {actions.length > 0 && (
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 lg:hidden"
                  aria-label={open ? 'Close menu' : 'Open menu'}
                  aria-expanded={open}
                  aria-controls="general-header-menu"
                  onClick={() => setMenuOpenOn(open ? null : pathname)}
                >
                  {open ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {actions.length > 0 && (
          <div
            id="general-header-menu"
            className={cn('marketing-gutter border-t border-slate-100 bg-white py-4 lg:hidden', !open && 'hidden')}
          >
            <div className="marketing-measure flex flex-col gap-3">
              {menuActions.map((action) => (
                <HeaderActionButton key={action.label} action={action} mobile onNavigate={closeMenu} />
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-[var(--md-border)] bg-white py-8 text-center text-sm text-[var(--md-muted)]">
        © {new Date().getFullYear()} MithraDirect · Local commerce, delivered
      </footer>
    </div>
  )
}
