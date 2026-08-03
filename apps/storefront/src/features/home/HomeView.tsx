import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { checkDeliveryEligibility } from '@mithra/api-client';
import { formatEligibilityMessage, formatMoney, minPrice } from '@mithra/domain';
import { Field } from '@mithra/ui';
import { USE_API } from '../../config';
import { useStore } from './store-context';

export function HomeView() {
  const {
    draft,
    vendorId,
    setView,
    setActiveCategory,
    setProductId,
    address,
    setAddress,
    pincode,
    setPincode,
  } = useStore();
  const popular = draft.products.filter((p) => p.popular);
  const heroBadges = draft.heroBadges?.length ? draft.heroBadges : ['100% Homemade'];
  const trustStrip = draft.trustStrip || [];
  const fulfillment = draft.fulfillment;
  const [eligMsg, setEligMsg] = useState('');

  const eligMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error('No vendor');
      const body: Record<string, string> = {};
      if (pincode) body.pincode = pincode;
      if (address) body.formatted_address = address;
      if (!body.pincode && !body.formatted_address) {
        throw new Error('Enter a pincode to check delivery.');
      }
      const res = await checkDeliveryEligibility(vendorId, body);
      return res.data || (res as unknown as { deliverable?: boolean; reason?: string });
    },
    onSuccess: (data) => setEligMsg(formatEligibilityMessage(data)),
    onError: (e) => setEligMsg(e instanceof Error ? e.message : 'Could not check delivery'),
  });

  return (
    <div>
      <section className="store-hero">
        {draft.settings.banner ? <img src={draft.settings.banner} alt="" /> : null}
        <div className="store-hero-overlay" />
        <div className="flex flex-wrap gap-2">
          {heroBadges.slice(0, 3).map((b) => (
            <span key={b} className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {b}
            </span>
          ))}
          {draft.verified ? (
            <span className="rounded-full bg-emerald-400/90 px-2 py-0.5 text-xs font-semibold text-emerald-950">
              Verified
            </span>
          ) : null}
        </div>
        <h1 className="md-display mt-2 text-3xl">{draft.settings.storeName}</h1>
        <p className="mt-1 text-sm text-white/90">{draft.settings.tagline}</p>
        <p className="mt-1 text-xs text-white/75">{draft.settings.location}</p>
      </section>

      <div className="space-y-6 p-4">
        {(fulfillment?.delivery_message || fulfillment?.pickup_message) && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-900">
            {fulfillment.home_delivery_available ? (
              <p>{fulfillment.delivery_message || 'Home delivery available'}</p>
            ) : null}
            {fulfillment.store_pickup_available ? (
              <p className="mt-1">{fulfillment.pickup_message || 'Store pickup available'}</p>
            ) : null}
          </div>
        )}

        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivering to</p>
          <p className="mt-1 text-sm font-medium">{address || 'Add your locality'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Field
              placeholder="Pincode (e.g. 500049)"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-label="Pincode"
            />
            <button
              type="button"
              className="md-btn md-btn-outline md-btn-sm"
              data-cta="check_delivery"
              disabled={eligMut.isPending || !USE_API || !vendorId}
              onClick={() => eligMut.mutate()}
            >
              {eligMut.isPending ? 'Checking…' : 'Check delivery'}
            </button>
          </div>
          {!USE_API || !vendorId ? (
            <p className="mt-2 text-xs text-slate-500">
              Live eligibility uses `POST /v1/vendors/&#123;id&#125;/delivery-eligibility` when API mode is on.
            </p>
          ) : null}
          {eligMsg ? (
            <p
              className={`mt-2 text-sm ${
                eligMsg.toLowerCase().includes('not') || eligMsg.toLowerCase().includes('sorry')
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {eligMsg}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-emerald-700"
            onClick={() => {
              const next = window.prompt('Enter delivery address', address);
              if (next?.trim()) setAddress(next.trim());
            }}
          >
            Change address
          </button>
        </div>

        {trustStrip.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {trustStrip.map((t) => (
              <div
                key={`${t.title}-${t.subtitle}`}
                className="min-w-[8rem] rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-[var(--shadow-sm)]"
              >
                <div className="text-xs font-bold text-slate-800">{t.title}</div>
                {t.subtitle ? <div className="text-[11px] text-slate-500">{t.subtitle}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="md-display text-lg">Categories</h2>
            <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => setView('menu')}>
              View menu
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {draft.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="min-w-[4.5rem] rounded-xl border border-slate-100 bg-white p-2 text-center shadow-[var(--shadow-sm)]"
                onClick={() => {
                  setActiveCategory(c.id);
                  setView('menu');
                }}
              >
                <div className="text-xl">{c.icon || '🍽️'}</div>
                <div className="mt-1 text-[11px] font-semibold">{c.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="md-display text-lg">Popular Products</h2>
            <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => setView('menu')}>
              View all
            </button>
          </div>
          <div className="product-grid">
            {(popular.length ? popular : draft.products).slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                className="product-card"
                onClick={() => {
                  setProductId(p.id);
                  setView('product');
                }}
              >
                <div className="flex h-24 items-center justify-center" style={{ background: p.color || '#ecfdf5' }}>
                  {p.image ? <img src={p.image} alt="" className="h-16 w-16 rounded-full object-cover" /> : null}
                </div>
                <div className="p-2.5">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">From {formatMoney(minPrice(p))}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          Powered by MithraDirect · This is a WhatsApp Order storefront
        </p>
      </div>
    </div>
  );
}
