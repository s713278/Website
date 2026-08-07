import { NavLink, Link } from 'react-router-dom';
import { env } from '@/shared/lib/env';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { canViewVendors } from '@/features/dashboard/lib/permissions';
import type { DashboardNavItem } from '@/features/dashboard/types';

const NAV_ITEMS: DashboardNavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: '⌂' },
  { to: '/dashboard/orders', label: 'Orders', icon: '☰', badgeKey: 'orders' },
  { to: '/dashboard/products', label: 'Products', icon: '▦' },
  { to: '/dashboard/store', label: 'Store & Share', icon: '↗' },
  { to: '/dashboard/settings', label: 'Settings', icon: '⚙' },
  { to: '/dashboard/audit-logs', label: 'Audit logs', icon: '◎' },
  { to: '/dashboard/vendors', label: 'Vendors', icon: '▣', roles: ['admin'] },
];

type Props = {
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate?: () => void;
  orderCount?: number;
  planLabel?: string;
};

export function DashboardSidebar({
  collapsed,
  mobileOpen,
  onNavigate,
  orderCount = 0,
  planLabel = 'Free plan',
}: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const items = NAV_ITEMS.filter((item) => {
    if (item.to === '/dashboard/vendors') return canViewVendors(role);
    if (!item.roles?.length) return true;
    return role ? item.roles.includes(role as 'vendor' | 'admin') : false;
  });

  return (
    <aside
      id="dash-sidebar"
      aria-label="Dashboard navigation"
      className={cn(
        'flex flex-col gap-4 border-border bg-[color-mix(in_srgb,#fff_92%,var(--store-theme-soft))] transition-[width,transform] lg:sticky lg:top-0 lg:h-dvh lg:border-r',
        collapsed ? 'lg:w-[4.5rem]' : 'lg:w-[15.5rem]',
        'fixed inset-y-0 left-0 z-40 w-[15.5rem] border-r p-3 lg:relative lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      <div className={cn('px-2 pt-1', collapsed && 'lg:px-1 lg:text-center')}>
        <Link to="/" className="font-display text-base font-bold text-md-green-deep" onClick={onNavigate}>
          {collapsed ? 'MD' : env.VITE_APP_NAME}
        </Link>
        {!collapsed ? (
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {role === 'admin' ? 'Admin dashboard' : 'Vendor dashboard'}
          </p>
        ) : null}
      </div>

      <nav className="grid flex-1 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors',
                collapsed && 'lg:justify-center lg:px-2',
                isActive
                  ? 'bg-[var(--store-theme-soft)] text-[color-mix(in_srgb,var(--store-theme)_85%,#000)] shadow-[inset_3px_0_0_var(--store-theme)]'
                  : 'hover:bg-[var(--store-theme-soft)] hover:text-[color-mix(in_srgb,var(--store-theme)_85%,#000)]',
              )
            }
          >
            <span aria-hidden className="w-4 text-center text-xs opacity-80">
              {item.icon}
            </span>
            <span className={cn(collapsed && 'lg:sr-only')}>{item.label}</span>
            {item.badgeKey === 'orders' && orderCount > 0 ? (
              <span
                className={cn(
                  'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--store-theme)] px-1.5 text-[0.65rem] font-bold text-white',
                  collapsed && 'lg:hidden',
                )}
              >
                {orderCount}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className={cn('grid gap-2 border-t border-border pt-3', collapsed && 'lg:hidden')}>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--store-theme)_45%,#fff)] bg-[var(--store-theme-soft)] px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--store-theme)]" aria-hidden />
          {planLabel}
        </div>
        <Link
          to="/store"
          onClick={onNavigate}
          className="rounded-full border-2 border-[color-mix(in_srgb,var(--store-theme)_35%,#fff)] bg-white px-3 py-2 text-center text-xs font-semibold text-secondary-foreground hover:bg-secondary"
        >
          View storefront
        </Link>
      </div>
    </aside>
  );
}
