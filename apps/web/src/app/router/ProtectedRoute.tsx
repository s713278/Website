import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type { UserRole } from '@/shared/types';
import { AuthSkeleton } from '@/shared/components/ui/skeleton';

type Props = {
  roles?: UserRole[];
  redirectTo?: string;
};

export function ProtectedRoute({ roles, redirectTo = '/auth/login' }: Props) {
  const location = useLocation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasRole = useAuthStore((s) => s.hasRole);

  if (!hydrated) return <AuthSkeleton />;

  if (!isAuthenticated()) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  if (roles?.length && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute({ redirectTo = '/dashboard' }: { redirectTo?: string }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!hydrated) return <AuthSkeleton />;
  if (isAuthenticated()) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}
