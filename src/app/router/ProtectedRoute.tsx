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

function hasUsableSession(user: unknown, accessFromStore: string | null) {
  if (!user) return false
  // Access JWT (even if near-expiry) OR refresh token means we can stay signed in.
  // Missing access alone must NOT force logout — interceptor will refresh on next API call.
  return Boolean(accessFromStore || getAccessToken() || getRefreshToken())
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const clearSession = useAuthStore((s) => s.clearSession)

  useEffect(() => {
    if (!isHydrated || !user) return
    // Only clear when BOTH tokens are gone.
    if (!getAccessToken() && !getRefreshToken()) {
      clearSession()
    }
  }, [isHydrated, user, token, clearSession])

  if (!isHydrated) return <Spinner label="Restoring session…" />

  if (!hasUsableSession(user, token)) {
    const intended = roles?.length === 1 ? roles[0] : undefined
    return <Navigate to={loginPathForRole(intended)} replace state={{ from: location.pathname }} />
  }

  if (roles && user && !roles.includes(user.role)) {
    const needed = roles[0]
    return <Navigate to={loginPathForRole(needed)} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
