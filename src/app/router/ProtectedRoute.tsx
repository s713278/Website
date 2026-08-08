import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Spinner } from '@/shared/components'
import type { UserRole } from '@/shared/types'

type ProtectedRouteProps = {
  roles?: UserRole[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isHydrated = useAuthStore((s) => s.isHydrated)

  if (!isHydrated) return <Spinner label="Restoring session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}
