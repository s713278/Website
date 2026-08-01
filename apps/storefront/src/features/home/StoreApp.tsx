import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  SAMPLE_STORE_SLUG,
  formatMoney,
  seedSaiRamDraft,
  whatsappLink,
} from '@mithra/domain';
import { applyVendorTheme, CartBar, Drawer, EmptyState } from '@mithra/ui';
import { MARKETING_URL, VENDOR_APP_URL } from '../../config';
import { StoreProvider, useStore } from './store-context';
import { HomeView } from './HomeView';
import { MenuView } from '../menu/MenuView';
import { ProductView } from '../product/ProductView';
import { CartView } from '../cart/CartView';
import { AuthView } from '../auth/AuthView';
import { CheckoutView } from '../checkout/CheckoutView';
import { SuccessView } from '../success/SuccessView';

function Shell() {
  const { storeSlug = '' } = useParams();
  const [params] = useSearchParams();
  const { draft, view, setView, cartCount, grandTotal } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    applyVendorTheme(draft.settings.themeColor);
    document.title = `${draft.settings.storeName} — MithraDirect`;
  }, [draft]);

  useEffect(() => {
    if (params.get('view') === 'menu') setView('menu');
  }, [params, setView]);

  if (storeSlug && storeSlug !== SAMPLE_STORE_SLUG && storeSlug !== draft.slug) {
    return (
      <EmptyState
        icon="🏪"
        title="Store not found"
        description="No store matched this link. Open the sample storefront or set up your own."
        primaryLabel="Open Sample Store"
        onPrimary={() => {
          window.location.href = `/${SAMPLE_STORE_SLUG}`;
        }}
        secondaryLabel="Setup Your Store"
        onSecondary={() => {
          window.location.href = `${VENDOR_APP_URL}/onboarding`;
        }}
      />
    );
  }

  const wa = draft.settings.whatsapp || draft.phone || '';

  return (
    <div className="md-body min-h-screen">
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-3">
          <a href={MARKETING_URL} className="text-sm font-semibold text-emerald-800">
            MithraDirect
          </a>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            Live Storefront
          </span>
          <a href={`${VENDOR_APP_URL}/onboarding`} className="md-btn md-btn-primary md-btn-sm">
            Create your store
          </a>
        </div>
      </header>

      <div className="store-shell">
        {draft.isSample ? (
          <div className="absolute right-3 top-16 z-20 rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-950">
            SAMPLE
          </div>
        ) : null}

        <header className="sticky top-14 z-30 flex h-14 items-center justify-between border-b border-slate-100 bg-white px-2">
          <button type="button" className="p-2" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
            ☰
          </button>
          <button
            type="button"
            className="flex items-center gap-2 font-semibold"
            onClick={() => setView('home')}
          >
            {draft.settings.logo ? (
              <img src={draft.settings.logo} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : null}
            <span className="md-display max-w-[10rem] truncate text-sm">{draft.settings.storeName}</span>
          </button>
          <div className="flex items-center gap-1">
            {wa ? (
              <a
                className="p-2 text-sm font-bold text-emerald-700"
                href={whatsappLink(wa, `Hi, I would like to order from ${draft.settings.storeName}`)}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                data-cta="header_wa"
              >
                WA
              </a>
            ) : null}
            <button type="button" className="relative p-2" aria-label="Cart" onClick={() => setView('cart')}>
              🛒
              {cartCount > 0 ? <span className="md-badge absolute right-0 top-0">{cartCount}</span> : null}
            </button>
          </div>
        </header>

        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <div className="mb-4 flex items-center gap-3">
            {draft.settings.logo ? (
              <img src={draft.settings.logo} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : null}
            <div>
              <div className="md-display font-bold">{draft.settings.storeName}</div>
              <div className="text-xs text-slate-500">{draft.settings.tagline}</div>
            </div>
          </div>
          {(
            [
              ['home', 'Home'],
              ['menu', 'Menu'],
              ['cart', 'Cart'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left font-medium hover:bg-emerald-50"
              onClick={() => {
                setDrawerOpen(false);
                setView(id);
              }}
            >
              {label}
            </button>
          ))}
          <a href={MARKETING_URL} className="mt-4 block px-3 text-sm text-slate-500">
            ← Back to MithraDirect
          </a>
        </Drawer>

        <main className="md-fade-in pb-24">
          {view === 'home' && <HomeView />}
          {view === 'menu' && <MenuView />}
          {view === 'product' && <ProductView />}
          {view === 'cart' && <CartView />}
          {view === 'login' && <AuthView />}
          {view === 'checkout' && <CheckoutView />}
          {view === 'success' && <SuccessView />}
        </main>

        <CartBar
          visible={cartCount > 0 && !['cart', 'login', 'checkout', 'success'].includes(view)}
          count={cartCount}
          totalLabel={formatMoney(grandTotal)}
          onGoToCart={() => setView('cart')}
        />
      </div>
    </div>
  );
}

export function StoreApp() {
  const draft = seedSaiRamDraft();
  return (
    <StoreProvider draft={draft}>
      <Shell />
    </StoreProvider>
  );
}
