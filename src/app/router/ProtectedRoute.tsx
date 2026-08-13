import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'vendor' ? '/vendor' : '/stores'} replace />
  }

  return <Outlet />
}
