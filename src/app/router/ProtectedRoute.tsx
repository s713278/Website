import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { loginPathForRole } from '@/app/router/role-home'
import { getCachedStore } from '@/modules/storefront/hooks/useStorePage'
import { customerLoginLink } from '@/modules/storefront/lib/cart-nav'
import { storeIdFromPath } from '@/modules/storefront/lib/store-paths'
import { getAccessToken, getRefreshToken } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Spinner } from '@/shared/components'
import type { UserRole } from '@/shared/types'

type ProtectedRouteProps = {
  /** customer → storefront account flows; vendor → /vendor (store-setup) */
  roles?: UserRole[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const clearSession = useAuthStore((s) => s.clearSession)
  // A merely expired access token is still recoverable through refresh, so credentials
  // count as present while either token exists.
  const hasCredentials = Boolean(getAccessToken() || getRefreshToken())

  useEffect(() => {
    if (isHydrated && user && !getAccessToken() && !getRefreshToken()) {
      clearSession()
    }
  }, [isHydrated, user, clearSession])

  if (!isHydrated) return <Spinner label="Restoring session…" />

  if (!user || !hasCredentials) {
    const intended = roles?.length === 1 ? roles[0] : undefined
    const from = `${location.pathname}${location.search}`
    if (intended === 'customer' || (!intended && storeIdFromPath(from))) {
      const shopId = storeIdFromPath(from)
      const cached = shopId ? getCachedStore(shopId) : null
      const login = customerLoginLink(
        from,
        cached ? { name: cached.name, logoUrl: cached.theme?.logoImage } : undefined,
      )
      return <Navigate to={login.to} replace state={login.state} />
    }
    return <Navigate to={loginPathForRole(intended)} replace state={{ from: location.pathname }} />
  }

  // The active login decides the session. A customer OTP must not open /vendor, and a
  // vendor OTP must not open customer orders, even when the same phone has both roles.
  if (roles && !roles.includes(user.role)) {
    const needed = roles[0]
    return <Navigate to={loginPathForRole(needed)} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
