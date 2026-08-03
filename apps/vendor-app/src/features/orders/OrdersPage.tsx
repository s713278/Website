import { useQuery } from '@tanstack/react-query';
import { getVendorOrders, getVendorStorefront } from '@mithra/api-client';
import { Button } from '@mithra/ui';
import { STOREFRONT_URL, USE_API } from '../../config';

export function OrdersPage() {
  const vendorId = Number(import.meta.env.VITE_SAMPLE_VENDOR_ID || 0);

  const storefront = useQuery({
    queryKey: ['vendor-storefront', vendorId],
    queryFn: () => getVendorStorefront(vendorId),
    enabled: USE_API && vendorId > 0,
  });

  const orders = useQuery({
    queryKey: ['vendor-orders', vendorId],
    queryFn: () => getVendorOrders(vendorId),
    enabled: USE_API && vendorId > 0,
  });

  const sf = (storefront.data?.data || storefront.data) as
    | {
        business_name?: string;
        store_identifier?: string;
        support_whatsapp_number?: string;
        share_link?: string;
        products?: unknown[];
      }
    | undefined;

  const storePath = sf?.store_identifier
    ? `${STOREFRONT_URL}/${sf.store_identifier}?vendor_id=${vendorId}`
    : `${STOREFRONT_URL}/store?vendor_id=${vendorId}`;

  return (
    <div className="md-body min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="md-display text-2xl">Orders</h1>
          <div className="flex gap-2">
            {USE_API && vendorId > 0 ? (
              <a href={storePath} className="md-btn md-btn-primary md-btn-sm" data-cta="view_storefront">
                View storefront
              </a>
            ) : null}
            <a href="/onboarding" className="md-btn md-btn-outline md-btn-sm">
              Back to onboarding
            </a>
          </div>
        </div>

        {!USE_API || vendorId <= 0 ? (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
            Set `VITE_USE_API=true` and `VITE_SAMPLE_VENDOR_ID` to load{' '}
            <code>GET /v1/vendors/&#123;id&#125;/storefront</code> and{' '}
            <code>GET /v1/vendors/&#123;id&#125;/orders/</code>.
          </p>
        ) : (
          <>
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
              <h2 className="font-semibold text-slate-800">Storefront (API)</h2>
              {storefront.isLoading ? (
                <p className="mt-2 text-sm text-slate-500">Loading storefront…</p>
              ) : storefront.isError ? (
                <p className="mt-2 text-sm text-red-600">{(storefront.error as Error).message}</p>
              ) : (
                <div className="mt-2 text-sm text-slate-600">
                  <p>
                    <strong>{sf?.business_name || '—'}</strong>
                    {sf?.store_identifier ? ` · ${sf.store_identifier}` : ''}
                  </p>
                  <p className="mt-1">WhatsApp: {sf?.support_whatsapp_number || '—'}</p>
                  <p className="mt-1">Products: {Array.isArray(sf?.products) ? sf!.products!.length : 0}</p>
                  {sf?.share_link ? (
                    <p className="mt-1 break-all text-xs text-slate-500">Share: {sf.share_link}</p>
                  ) : null}
                </div>
              )}
            </section>

            <section className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Order inbox</h2>
                <Button variant="outline" size="sm" onClick={() => orders.refetch()}>
                  Refresh
                </Button>
              </div>
              {orders.isLoading ? (
                <p className="text-slate-500">Loading…</p>
              ) : orders.isError ? (
                <p className="text-red-600">{(orders.error as Error).message}</p>
              ) : (
                <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-100">
                  {JSON.stringify(orders.data, null, 2)}
                </pre>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
