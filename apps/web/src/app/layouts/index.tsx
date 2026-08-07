import { Link, Outlet } from 'react-router-dom';
import { env } from '@/shared/lib/env';
import { StoreShell } from '@/features/storefront/components/StoreShell';

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
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="border-b border-border bg-white/95 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="p-4">
          <Link to="/" className="font-display text-base font-bold text-md-green-deep">
            {env.VITE_APP_NAME}
          </Link>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Vendor dashboard</p>
          <nav className="mt-6 grid gap-1 text-sm font-semibold text-muted-foreground">
            <span className="rounded-lg bg-secondary px-3 py-2 text-secondary-foreground">Overview</span>
            <span className="px-3 py-2">Orders</span>
            <span className="px-3 py-2">Products</span>
            <span className="px-3 py-2">Store & Share</span>
            <span className="px-3 py-2">Settings</span>
          </nav>
        </div>
      </aside>
      <div>
        <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <h1 className="font-display text-lg font-bold">Dashboard</h1>
            <SurfaceBadge label="dashboard" />
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
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
