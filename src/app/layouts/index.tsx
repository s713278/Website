import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import logoDarkMd from '@/assets/logo_dark_md.png'
import { canShopAsCustomer, homePathForUser, loginPathForRole } from '@/app/router/role-home'
import { cartNavTarget, linkFromNavTarget, visibleCartCount } from '@/modules/storefront/lib/cart-nav'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
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

function linkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-lg px-3 py-2.5 text-sm font-medium transition',
    isActive ? 'bg-[var(--md-green-50)] text-[var(--md-green-800)]' : 'text-slate-600 hover:bg-slate-100',
  )
}

export function RootLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const cartCount = visibleCartCount(user, useCartStore((s) => s.itemCount()))
  const cartLink = linkFromNavTarget(cartNavTarget(user))
  // The menu belongs to the page it was opened on, so following any link in it closes it.
  const { pathname } = useLocation()
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const open = menuOpenOn === pathname
  const closeMenu = () => setMenuOpenOn(null)

  const navLinks = (
    <>
      <NavLink to="/stores" className={linkClass} onClick={closeMenu}>Stores</NavLink>
      {canShopAsCustomer(user) ? (
        <NavLink to="/orders" className={linkClass} onClick={closeMenu}>Orders</NavLink>
      ) : null}
      {user?.role === 'vendor' ? (
        <NavLink to="/vendor" className={linkClass} onClick={closeMenu}>Dashboard</NavLink>
      ) : null}
    </>
  )

  function accountActions(mobile?: boolean) {
    return user ? (
      <>
        <span className={cn('text-sm text-slate-500', mobile ? 'px-3' : 'hidden xl:inline')}>Welcome, {user.name}</span>
        <Button
          size="sm"
          className="h-10"
          variant="secondary"
          fullWidth={mobile}
          onClick={() => {
            closeMenu()
            void logout()
          }}
        >
          Sign out
        </Button>
        {user.role === 'vendor' ? (
          <NavLink to="/onboarding" onClick={closeMenu}>
            <Button size="sm" className="h-10" variant="ghost" fullWidth={mobile}>Store setup</Button>
          </NavLink>
        ) : (
          <NavLink to={homePathForUser(user)} onClick={closeMenu}>
            <Button size="sm" className="h-10" variant="ghost" fullWidth={mobile}>Home</Button>
          </NavLink>
        )}
      </>
    ) : (
      <>
        <NavLink to={loginPathForRole('customer')} onClick={closeMenu}>
          <Button size="sm" className="h-10" variant="secondary" fullWidth={mobile}>Sign in</Button>
        </NavLink>
        <NavLink to={loginPathForRole('vendor')} onClick={closeMenu}>
          <Button size="sm" className="h-10" fullWidth={mobile}>Open store</Button>
        </NavLink>
      </>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-emerald-100/70 bg-white/95 backdrop-blur">
        {/* Below `lg` a signed-in vendor's links and actions no longer fit beside the logo, so
            they move into the menu. Cart stays in the bar: it is the one shoppers reach for. */}
        <div className="marketing-gutter">
          <div className="marketing-measure flex h-(--header-height) items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-6">
              <Brand />
              <nav className="hidden items-center gap-1 lg:flex">{navLinks}</nav>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(canShopAsCustomer(user) || !user) && (
                <NavLink to={cartLink.to} state={cartLink.state} className={linkClass} onClick={closeMenu}>
                  Cart{cartCount ? ` (${cartCount})` : ''}
                </NavLink>
              )}
              <div className="hidden items-center gap-2 lg:flex">{accountActions()}</div>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 lg:hidden"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                onClick={() => setMenuOpenOn(open ? null : pathname)}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className={cn('marketing-gutter border-t border-slate-100 bg-white py-4 lg:hidden', !open && 'hidden')}>
          <div className="marketing-measure flex flex-col gap-3">
            <nav className="flex flex-col gap-1">{navLinks}</nav>
            {accountActions(true)}
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-[var(--md-border)] bg-white py-8 text-center text-sm text-[var(--md-muted)]">
        © {new Date().getFullYear()} MithraDirect · Local commerce, delivered
      </footer>
    </div>
  )
}
