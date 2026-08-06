import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createVendor,
  getCategories,
  putCheckoutOptions,
  patchVendorStatus,
  requestOtp,
  updateVendor,
  verifyOtp,
  ApiError,
} from '@mithra/api-client';
import { slugify, whatsappLink } from '@mithra/domain';
import { Button, Field, OtpInput, PhoneInput, PhonePreview, Stepper } from '@mithra/ui';
import { MARKETING_URL, STOREFRONT_URL, USE_API } from '../../config';

const BUSINESS_TYPES = [
  { id: 'home-kitchen', label: 'Home Kitchen' },
  { id: 'pickles', label: 'Pickles' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'spices', label: 'Spices' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'organic', label: 'Organic' },
  { id: 'crafts', label: 'Crafts' },
];

type Draft = {
  phone: string;
  businessType: string;
  categories: string[];
  categoryIds: number[];
  products: Array<{ name: string; skuLabel: string; price: number; mrp: number }>;
  storePickup: boolean;
  homeDelivery: boolean;
  homeCharge: number;
  upiEnabled: boolean;
  upiId: string;
  codEnabled: boolean;
  storeName: string;
  tagline: string;
  location: string;
  whatsapp: string;
  themeColor: string;
  vendorId?: number;
};

const empty: Draft = {
  phone: '',
  businessType: '',
  categories: [],
  categoryIds: [],
  products: [{ name: '', skuLabel: '250g', price: 0, mrp: 0 }],
  storePickup: true,
  homeDelivery: true,
  homeCharge: 40,
  upiEnabled: true,
  upiId: '',
  codEnabled: true,
  storeName: '',
  tagline: '',
  location: '',
  whatsapp: '',
  themeColor: '#10b981',
};

const FALLBACK_CATEGORIES = ['Pickles', 'Podulu', 'Snacks', 'Sweets', 'Curries'];

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(empty);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveSlug, setLiveSlug] = useState('');

  const slug = useMemo(() => slugify(draft.storeName || 'my-store'), [draft.storeName]);

  const categoriesQuery = useQuery({
    queryKey: ['platform-categories'],
    queryFn: async () => {
      const res = await getCategories();
      const data = res.data ?? res;
      if (Array.isArray(data)) return data as Array<{ id?: number; name?: string }>;
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        for (const key of ['categories', 'content', 'items']) {
          if (Array.isArray(obj[key])) return obj[key] as Array<{ id?: number; name?: string }>;
        }
      }
      return [] as Array<{ id?: number; name?: string }>;
    },
    enabled: USE_API,
  });

  const categoryOptions = USE_API && categoriesQuery.data?.length
    ? categoriesQuery.data
        .filter((c) => c.name)
        .map((c) => ({ id: Number(c.id), name: String(c.name) }))
    : FALLBACK_CATEGORIES.map((name, i) => ({ id: i + 1, name }));

  const requestOtpMut = useMutation({
    mutationFn: () =>
      requestOtp({
        country_code: '+91',
        mobile_number: draft.phone,
        reg_platform: 'WEB',
        user_role: 'VENDOR',
      }),
  });

  const verifyOtpMut = useMutation({
    mutationFn: () =>
      verifyOtp({
        country_code: '+91',
        mobile_number: draft.phone,
        otp,
      }),
  });

  async function next() {
    setError('');
    try {
      if (step === 1) {
        if (!/^\d{10}$/.test(draft.phone)) throw new Error('Enter a valid 10-digit mobile.');
        if (USE_API) {
          await requestOtpMut.mutateAsync();
        }
        setOtpSent(true);
        setStep(2);
        return;
      }
      if (step === 2) {
        if (otp.length !== 6) throw new Error('Enter 6-digit OTP.');
        if (USE_API) {
          await verifyOtpMut.mutateAsync();
        }
        setStep(3);
        return;
      }
      if (step === 3 && !draft.businessType) throw new Error('Pick a business type.');
      if (step === 4 && draft.categories.length < 1) throw new Error('Pick at least one category.');
      if (step === 5 && !draft.products.some((p) => p.name.trim())) throw new Error('Add at least one product.');
      if (step === 6 && draft.products.some((p) => !p.skuLabel || p.price <= 0))
        throw new Error('Each product needs a SKU label and price > 0.');
      if (step === 7 && !draft.storePickup && !draft.homeDelivery) throw new Error('Enable a delivery method.');
      if (step === 8 && !draft.upiEnabled && !draft.codEnabled) throw new Error('Enable a payment method.');
      if (step === 9) {
        if (!draft.storeName.trim()) throw new Error('Store name required.');
        if (!/^\d{10}$/.test(draft.whatsapp || draft.phone)) throw new Error('WhatsApp number required.');
        setBusy(true);
        if (USE_API) {
          const created = await createVendor({
            business_name: draft.storeName,
            business_type: draft.businessType,
            description: draft.tagline,
            contact_number: draft.whatsapp || draft.phone,
            fulfillment_type: draft.homeDelivery && draft.storePickup ? 'BOTH' : draft.homeDelivery ? 'HOME_DELIVERY' : 'STORE_PICKUP',
            assign_categories: {
              category_ids:
                draft.categoryIds.length > 0
                  ? draft.categoryIds
                  : draft.categories.map((_, i) => i + 1),
            },
          });
          const vendorId =
            (created.data as { vendor_id?: number; id?: number } | undefined)?.vendor_id ||
            (created.data as { id?: number } | undefined)?.id;
          if (vendorId) {
            setDraft((d) => ({ ...d, vendorId }));
            await updateVendor(vendorId, {
              business_name: draft.storeName,
              description: draft.tagline,
            });
            await putCheckoutOptions(vendorId, {
              fulfillment_type:
                draft.homeDelivery && draft.storePickup
                  ? 'BOTH'
                  : draft.homeDelivery
                    ? 'HOME_DELIVERY'
                    : 'STORE_PICKUP',
              payment_options: [
                draft.codEnabled ? { type: 'COD', label: 'Cash on Delivery', default: true } : null,
                draft.upiEnabled
                  ? { type: 'UPI', label: 'UPI', details: { upi_id: draft.upiId } }
                  : null,
              ].filter(Boolean),
              shipping_config: { home_delivery_charge: draft.homeCharge },
            });
            await patchVendorStatus(vendorId, { status: 'ACTIVE' });
          }
        }
        setLiveSlug(slug);
        setStep(10);
        setBusy(false);
        return;
      }
      if (step < 10) setStep((s) => s + 1);
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  const storeUrl = draft.vendorId
    ? `${STOREFRONT_URL}/${liveSlug || slug}?vendor_id=${draft.vendorId}`
    : `${STOREFRONT_URL}/${liveSlug || slug}`;

  return (
    <div className="md-body min-h-screen">
      <header className="border-b border-emerald-100 bg-white/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <a href={MARKETING_URL} className="font-bold text-emerald-900">
            MithraDirect
          </a>
          <Stepper current={step} total={10} />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h1 className="md-display text-2xl text-slate-900">Store setup</h1>
          <p className="mt-1 text-sm text-slate-500">Step {step} of 10 · ~10 minutes</p>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          {!USE_API ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Demo mode (`VITE_USE_API` not true). OTP accepts any 6 digits; vendor APIs skipped.
            </p>
          ) : null}

          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
            {step === 1 && (
              <PhoneInput value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
            )}
            {step === 2 && (
              <>
                <OtpInput value={otp} onChange={setOtp} />
                <p className="text-xs text-slate-500">
                  {otpSent ? 'OTP sent (or demo).' : ''} Enter any 6 digits in demo mode.
                </p>
              </>
            )}
            {step === 3 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BUSINESS_TYPES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`rounded-xl border p-3 text-sm font-semibold ${
                      draft.businessType === b.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200'
                    }`}
                    onClick={() => setDraft({ ...draft, businessType: b.id })}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
            {step === 4 && (
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((c) => {
                  const on = draft.categoryIds.includes(c.id) || draft.categories.includes(c.name);
                  return (
                    <button
                      key={`${c.id}-${c.name}`}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                      }`}
                      onClick={() => {
                        setDraft((d) => {
                          const has = d.categoryIds.includes(c.id);
                          if (has) {
                            return {
                              ...d,
                              categoryIds: d.categoryIds.filter((x) => x !== c.id),
                              categories: d.categories.filter((x) => x !== c.name),
                            };
                          }
                          if (d.categoryIds.length >= 2) return d;
                          return {
                            ...d,
                            categoryIds: [...d.categoryIds, c.id],
                            categories: [...d.categories, c.name],
                          };
                        });
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {step === 5 && (
              <div className="space-y-3">
                {draft.products.map((p, i) => (
                  <Field
                    key={i}
                    label={`Product ${i + 1}`}
                    value={p.name}
                    onChange={(e) => {
                      const products = [...draft.products];
                      products[i] = { ...products[i], name: e.target.value };
                      setDraft({ ...draft, products });
                    }}
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      products: [...draft.products, { name: '', skuLabel: '250g', price: 0, mrp: 0 }],
                    })
                  }
                >
                  Add product
                </Button>
              </div>
            )}
            {step === 6 && (
              <div className="space-y-4">
                {draft.products.map((p, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-3">
                    <Field label={`${p.name || 'Product'} SKU`} value={p.skuLabel} onChange={(e) => {
                      const products = [...draft.products];
                      products[i] = { ...products[i], skuLabel: e.target.value };
                      setDraft({ ...draft, products });
                    }} />
                    <Field label="Price" type="number" value={p.price || ''} onChange={(e) => {
                      const products = [...draft.products];
                      products[i] = { ...products[i], price: Number(e.target.value) };
                      setDraft({ ...draft, products });
                    }} />
                    <Field label="MRP" type="number" value={p.mrp || ''} onChange={(e) => {
                      const products = [...draft.products];
                      products[i] = { ...products[i], mrp: Number(e.target.value) };
                      setDraft({ ...draft, products });
                    }} />
                  </div>
                ))}
              </div>
            )}
            {step === 7 && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.storePickup}
                    onChange={(e) => setDraft({ ...draft, storePickup: e.target.checked })}
                  />
                  Store pickup
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.homeDelivery}
                    onChange={(e) => setDraft({ ...draft, homeDelivery: e.target.checked })}
                  />
                  Home delivery
                </label>
                {draft.homeDelivery ? (
                  <Field
                    label="Delivery charge"
                    type="number"
                    value={draft.homeCharge}
                    onChange={(e) => setDraft({ ...draft, homeCharge: Number(e.target.value) })}
                  />
                ) : null}
              </div>
            )}
            {step === 8 && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.codEnabled}
                    onChange={(e) => setDraft({ ...draft, codEnabled: e.target.checked })}
                  />
                  Cash on delivery
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.upiEnabled}
                    onChange={(e) => setDraft({ ...draft, upiEnabled: e.target.checked })}
                  />
                  UPI
                </label>
                {draft.upiEnabled ? (
                  <Field
                    label="UPI ID"
                    value={draft.upiId}
                    onChange={(e) => setDraft({ ...draft, upiId: e.target.value })}
                  />
                ) : null}
              </div>
            )}
            {step === 9 && (
              <div className="space-y-3">
                <Field label="Store name" value={draft.storeName} onChange={(e) => setDraft({ ...draft, storeName: e.target.value })} />
                <Field label="Tagline" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
                <Field label="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                <Field label="WhatsApp" value={draft.whatsapp || draft.phone} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                <Field label="Theme color" type="color" value={draft.themeColor} onChange={(e) => setDraft({ ...draft, themeColor: e.target.value })} />
              </div>
            )}
            {step === 10 && (
              <div className="space-y-4">
                <p className="text-lg font-semibold text-emerald-800">Store live!</p>
                <p className="text-sm text-slate-600 break-all">{storeUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <a className="md-btn md-btn-primary" href={storeUrl} data-cta="view_my_store">
                    View my store
                  </a>
                  <a
                    className="md-btn md-btn-wa"
                    data-cta="share_whatsapp"
                    href={whatsappLink('', `Check out my store on MithraDirect: ${storeUrl}`).replace(
                      'wa.me/?text=',
                      'wa.me/?text=',
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share on WhatsApp
                  </a>
                  <Button
                    variant="outline"
                    data-cta="copy_store_link"
                    onClick={() => navigator.clipboard.writeText(storeUrl)}
                  >
                    Copy store link
                  </Button>
                  <a className="md-btn md-btn-outline" href="/orders">
                    Manage orders
                  </a>
                </div>
              </div>
            )}

            {step < 10 ? (
              <div className="flex justify-between pt-2">
                <Button variant="outline" disabled={step <= 1 || busy} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  Back
                </Button>
                <Button onClick={next} disabled={busy} data-cta="onboarding_continue">
                  {step === 1 ? 'Send OTP' : step === 2 ? 'Verify & continue' : step === 9 ? 'Go live' : 'Continue'}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden lg:col-span-2 lg:block">
          <p className="mb-3 text-sm font-semibold text-slate-500">Live preview</p>
          <PhonePreview>
            <div
              className="flex h-full flex-col bg-gradient-to-b from-emerald-50 to-white p-4"
              style={{ ['--store-theme' as string]: draft.themeColor }}
            >
              <div className="mt-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                  🏪
                </div>
                <h2 className="md-display text-lg">{draft.storeName || 'Your store'}</h2>
                <p className="text-xs text-slate-500">{draft.tagline || 'Tagline'}</p>
              </div>
              <div className="mt-4 space-y-2">
                {draft.products
                  .filter((p) => p.name)
                  .slice(0, 3)
                  .map((p) => (
                    <div key={p.name} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.skuLabel} · ₹{p.price || '—'}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </PhonePreview>
        </div>
      </div>
    </div>
  );
}
