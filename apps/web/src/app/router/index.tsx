import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { PageSkeleton } from '@/shared/components/ui/skeleton';
import {
  AuthLayout,
  DashboardLayout,
  MarketingLayout,
  OnboardingLayout,
  StoreLayout,
} from '@/app/layouts';
import { ProtectedRoute, PublicOnlyRoute } from '@/app/router/ProtectedRoute';

const MarketingHomePage = lazy(() =>
  import('@/features/marketing/pages/MarketingHomePage').then((m) => ({
    default: m.MarketingHomePage,
  })),
);
const StoreHomePage = lazy(() =>
  import('@/features/storefront/pages/StoreHomePage').then((m) => ({ default: m.StoreHomePage })),
);
const OnboardingHomePage = lazy(() =>
  import('@/features/onboarding/pages/OnboardingHomePage').then((m) => ({
    default: m.OnboardingHomePage,
  })),
);
const DashboardHomePage = lazy(() =>
  import('@/features/dashboard/pages/DashboardHomePage').then((m) => ({
    default: m.DashboardHomePage,
  })),
);
const LoginPage = lazy(() =>
  import('@/features/auth/components/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const NotFoundPage = lazy(() =>
  import('@/features/marketing/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

function RouteFrame({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <ErrorBoundary fallbackTitle={title}>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RouteFrame title="Marketing error">
        <MarketingLayout />
      </RouteFrame>
    ),
    children: [{ index: true, element: <MarketingHomePage /> }],
  },
  {
    path: '/store',
    element: (
      <RouteFrame title="Storefront error">
        <StoreLayout />
      </RouteFrame>
    ),
    children: [{ index: true, element: <StoreHomePage /> }],
  },
  {
    path: '/onboarding',
    element: (
      <RouteFrame title="Onboarding error">
        <OnboardingLayout />
      </RouteFrame>
    ),
    children: [{ index: true, element: <OnboardingHomePage /> }],
  },
  {
    path: '/auth',
    element: <PublicOnlyRoute />,
    children: [
      {
        element: (
          <RouteFrame title="Auth error">
            <AuthLayout />
          </RouteFrame>
        ),
        children: [
          { index: true, element: <Navigate to="login" replace /> },
          { path: 'login', element: <LoginPage /> },
        ],
      },
    ],
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute roles={['vendor', 'admin']} />,
    children: [
      {
        element: (
          <RouteFrame title="Dashboard error">
            <DashboardLayout />
          </RouteFrame>
        ),
        children: [{ index: true, element: <DashboardHomePage /> }],
      },
    ],
  },
  {
    path: '*',
    element: (
      <RouteFrame>
        <MarketingLayout />
      </RouteFrame>
    ),
    children: [{ index: true, element: <NotFoundPage /> }],
  },
]);

/** Re-export for tests / nested routers */
export { Outlet };
