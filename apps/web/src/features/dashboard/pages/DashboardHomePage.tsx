import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useDashboardOrders } from '@/features/dashboard/hooks/use-dashboard-orders';
import { useDashboardProducts } from '@/features/dashboard/hooks/use-dashboard-products';
import { useDashboardStoreInfo } from '@/features/dashboard/hooks/use-dashboard-vendor';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';
import { AuditLogList } from '@/features/dashboard/components/AuditLogList';
import { MetricsSkeleton, TableSkeleton } from '@/features/dashboard/components/Skeletons';
import { StatusBadge } from '@/features/dashboard/components/StatusBadge';
import { formatInr, formatDateTime, orderStatusLabel } from '@/features/dashboard/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function DashboardHomePage() {
  const user = useAuthStore((s) => s.user);
  const store = useDashboardStoreInfo();
  const { orders, isLoading: ordersLoading, usingDemo } = useDashboardOrders();
  const { products, isLoading: productsLoading } = useDashboardProducts();
  const { entries } = useAuditLog();

  const loading = ordersLoading || productsLoading;
  const today = new Date().toDateString();
  const ordersToday = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;
  const pending = orders.filter((o) => o.status === 'new' || o.status === 'confirmed').length;
  const sales = orders.reduce((sum, o) => sum + (o.status === 'cancelled' ? 0 : o.amount), 0);
  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Welcome back{user?.name ? `, ${user.name}` : ''}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {store.storeName} · {usingDemo ? 'Demo data' : 'Live API'} · signed in as {user?.role}
        </p>
      </div>

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Orders today', value: String(ordersToday) },
            { label: 'Sales', value: formatInr(sales) },
            { label: 'Products', value: String(products.length) },
            { label: 'Pending', value: String(pending) },
          ].map((m) => (
            <article
              key={m.label}
              className="rounded-2xl border border-border bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {m.label}
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-md-green-deep">{m.value}</p>
            </article>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Recent orders</CardTitle>
          <Link to="/dashboard/orders" className="text-sm font-semibold text-primary hover:underline">
            See all
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} />
          ) : recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No orders yet. Share your store link to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3">Order</th>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3">Amount</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id} className="border-t border-border/70">
                      <td className="py-2.5 pr-3">
                        <strong>{o.id}</strong>
                        <div className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</div>
                      </td>
                      <td className="py-2.5 pr-3">{o.customer}</td>
                      <td className="py-2.5 pr-3">{formatInr(o.amount)}</td>
                      <td className="py-2.5">
                        <StatusBadge status={o.status} label={orderStatusLabel(o.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: '/dashboard/store', title: 'Share shop link', sub: 'WhatsApp & Instagram' },
          { to: '/dashboard/products', title: 'Manage products', sub: 'Prices & SKUs' },
          { to: '/store', title: 'Open storefront', sub: 'Customer view' },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-[color-mix(in_srgb,var(--store-theme)_35%,var(--md-border))] hover:bg-secondary/50"
          >
            <strong className="font-display text-base">{q.title}</strong>
            <p className="mt-1 text-sm text-muted-foreground">{q.sub}</p>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Recent activity</CardTitle>
          <Link to="/dashboard/audit-logs" className="text-sm font-semibold text-primary hover:underline">
            Audit logs
          </Link>
        </CardHeader>
        <CardContent>
          <AuditLogList entries={entries} limit={5} />
        </CardContent>
      </Card>
    </div>
  );
}
