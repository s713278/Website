import { useQuery } from '@tanstack/react-query';
import { getVendorOrders } from '@mithra/api-client';
import { Button } from '@mithra/ui';
import { USE_API } from '../../config';

export function OrdersPage() {
  const vendorId = Number(import.meta.env.VITE_SAMPLE_VENDOR_ID || 0);
  const q = useQuery({
    queryKey: ['vendor-orders', vendorId],
    queryFn: () => getVendorOrders(vendorId),
    enabled: USE_API && vendorId > 0,
  });

  return (
    <div className="md-body min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="md-display text-2xl">Orders</h1>
          <a href="/onboarding" className="md-btn md-btn-outline md-btn-sm">
            Back to onboarding
          </a>
        </div>
        {!USE_API || vendorId <= 0 ? (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
            Set `VITE_USE_API=true` and `VITE_SAMPLE_VENDOR_ID` to load vendor orders from{' '}
            <code>GET /v1/vendors/&#123;id&#125;/orders/</code>.
          </p>
        ) : q.isLoading ? (
          <p className="mt-6">Loading…</p>
        ) : q.isError ? (
          <p className="mt-6 text-red-600">{(q.error as Error).message}</p>
        ) : (
          <pre className="mt-6 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-100">
            {JSON.stringify(q.data, null, 2)}
          </pre>
        )}
        <div className="mt-4">
          <Button variant="outline" onClick={() => q.refetch()} disabled={!USE_API}>
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
