import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { applyVendorTheme } from '@mithra/ui';
import { StoreShell } from '@/features/storefront/components/StoreShell';
import { DashboardSidebar } from '@/features/dashboard/components/Sidebar';
import { useDashboardOrders } from '@/features/dashboard/hooks/use-dashboard-orders';
import { useDashboardStoreInfo } from '@/features/dashboard/hooks/use-dashboard-vendor';
import { getDashRouteMeta } from '@/features/dashboard/lib/nav';
import { Breadcrumbs } from '@/shared/components/Breadcrumbs';
import { Button } from '@/shared/components/ui/button';
import { env } from '@/shared/lib/env';

function SurfaceBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
      {label}
    </span>
  );
}

export function MarketingLayout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/90 backdrop-blur">
        <div className="md-container flex h-16 items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg font-bold text-md-green-deep">
            {env.VITE_APP_NAME}
          </Link>
          <SurfaceBadge label="Marketing · index" />
        </div>
      </header>
      <main className="md-container py-8">
        <Outlet />
      </main>
    </div>
  );
}

/** Storefront owns full chrome (header/cart) — no competing shell. */
export function StoreLayout() {
  return <StoreShell />;
}

/** Onboarding page owns its own header / summary chrome. */
export function OnboardingLayout() {
  return <Outlet />;
}

export function DashboardLayout() {
  const location = useLocation();
  const meta = getDashRouteMeta(location.pathname);
  const store = useDashboardStoreInfo();
  const { orders } = useDashboardOrders();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (store.themeColor) applyVendorTheme(store.themeColor);
  }, [store.themeColor]);

  const pendingOrders = orders.filter((o) => o.status === 'new').length;

  return (
    <div className="min-h-dvh bg-[var(--md-atmosphere)] lg:flex">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <DashboardSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        orderCount={pendingOrders}
        planLabel={store.planLabel}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="lg:hidden"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                aria-controls="dash-sidebar"
                onClick={() => setMobileOpen(true)}
              >
                <span aria-hidden className="text-lg">
                  ☰
                </span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="hidden lg:inline-flex"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setCollapsed((v) => !v)}
              >
                <span aria-hidden className="text-sm font-bold">
                  {collapsed ? '»' : '«'}
                </span>
              </Button>
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold">{meta.title}</h1>
                <p className="truncate text-xs font-semibold text-muted-foreground">
                  {store.storeName}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to="/onboarding"
                className="hidden text-sm font-semibold text-muted-foreground hover:text-md-green-deep sm:inline"
              >
                Setup
              </Link>
              <SurfaceBadge label="dashboard" />
            </div>
          </div>
          <div className="border-t border-border/70 px-4 py-2 sm:px-6">
            <Breadcrumbs items={meta.crumbs} />
          </div>
        </header>
        <main className="p-4 pb-24 sm:p-6 lg:pb-6">
          <Outlet />
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-white/95 px-1 py-1 backdrop-blur lg:hidden"
          aria-label="Mobile navigation"
          style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
        >
          {[
            { to: '/dashboard', label: 'Overview' },
            { to: '/dashboard/orders', label: 'Orders' },
            { to: '/dashboard/products', label: 'Products' },
            { to: '/dashboard/store', label: 'Share' },
          ].map((item) => {
            const active =
              item.to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  active
                    ? 'rounded-lg bg-secondary px-2 py-2 text-center text-xs font-bold text-secondary-foreground'
                    : 'rounded-lg px-2 py-2 text-center text-xs font-semibold text-muted-foreground'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
