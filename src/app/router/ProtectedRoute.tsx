import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { loginPathForRole } from '@/app/router/role-home'
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
    return <Navigate to={loginPathForRole(intended)} replace state={{ from: location.pathname }} />
  }

  // `roles` is what the backend verified; `role` is only the audience picked at login.
  // Guarding on the latter locks a vendor out of their own store setup for having used
  // the customer form, and loops against any redirect that sends them back to it.
  if (roles && !roles.some((role) => user.roles.includes(role))) {
    const needed = roles[0]
    return <Navigate to={loginPathForRole(needed)} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
