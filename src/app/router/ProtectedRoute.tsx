import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { loginPathForRole } from '@/app/router/role-home'
import { getAccessToken } from '@/shared/api'
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
  const hasToken = Boolean(getAccessToken())

  useEffect(() => {
    if (isHydrated && user && !getAccessToken()) {
      clearSession()
    }
  }, [isHydrated, user, clearSession])

  if (!isHydrated) return <Spinner label="Restoring session…" />

  if (!user || !hasToken) {
    const intended = roles?.length === 1 ? roles[0] : undefined
    return <Navigate to={loginPathForRole(intended)} replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    const needed = roles[0]
    return <Navigate to={loginPathForRole(needed)} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
