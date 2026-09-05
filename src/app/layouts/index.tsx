import { NavLink, Outlet } from 'react-router-dom'
import { homePathForUser, loginPathForRole } from '@/app/router/role-home'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

function Brand() {
  return (
    <NavLink to="/" className="font-display text-lg font-bold text-[var(--md-green-700)]">
      MithraDirect
    </NavLink>
  )
}

function linkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-[var(--md-green-50)] text-[var(--md-green-800)]' : 'text-slate-600 hover:bg-slate-100',
  )
}

export function RootLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const cartCount = useCartStore((s) => s.itemCount())

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--md-border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Brand />
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/stores" className={linkClass}>Stores</NavLink>
              {user?.role === 'customer' ? (
                <NavLink to="/orders" className={linkClass}>Orders</NavLink>
              ) : null}
              {user?.role === 'vendor' ? (
                <NavLink to="/vendor" className={linkClass}>Dashboard</NavLink>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {(user?.role === 'customer' || !user) && (
              <NavLink to="/cart" className={linkClass}>
                Cart{cartCount ? ` (${cartCount})` : ''}
              </NavLink>
            )}
            {user ? (
              <>
                <span className="hidden text-sm text-slate-500 sm:inline">Welcome, {user.name}</span>
                <Button size="sm" variant="secondary" onClick={() => void logout()}>Log out</Button>
                {user.role === 'vendor' ? (
                  <NavLink to="/vendor">
                    <Button size="sm" variant="ghost">Store setup</Button>
                  </NavLink>
                ) : (
                  <NavLink to={homePathForUser(user)}>
                    <Button size="sm" variant="ghost">Home</Button>
                  </NavLink>
                )}
              </>
            ) : (
              <>
                <NavLink to={loginPathForRole('customer')}><Button size="sm" variant="secondary">Sign in</Button></NavLink>
                <NavLink to={loginPathForRole('vendor')}><Button size="sm">Open store</Button></NavLink>
              </>
            )}
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

export function VendorLayout() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <nav className="flex flex-wrap gap-2 border-b border-[var(--md-border)] py-4">
        <NavLink to="/vendor" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/vendor/orders" className={linkClass}>Orders</NavLink>
        <NavLink to="/vendor/products" className={linkClass}>Products</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
