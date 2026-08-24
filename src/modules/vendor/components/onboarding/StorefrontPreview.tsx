import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPinIcon, MenuIcon, MessageCircleIcon, ShoppingBagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { applyStoreTheme, clearStoreTheme, normalizeHex } from '@/shared/lib/theme'
import { bestContrastText, validateDraftSku } from '../../lib/onboarding-validation'
import type { VendorOnboardingDraftV1 } from '../../types/onboarding'

type StorefrontPreviewProps = {
  draft: VendorOnboardingDraftV1
  logoUrl: string | null
  bannerUrl: string | null
  fullPage?: boolean
}

function PreviewImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) {
    return (
      <div
        aria-label={`${alt} image unavailable`}
        className={cn('grid place-items-center bg-[var(--store-theme-soft)] text-[var(--store-theme)]', className)}
      >
        <ShoppingBagIcon className="size-5" aria-hidden="true" />
      </div>
    )
  }
  return <img src={src} alt={alt} className={cn('object-cover', className)} onError={() => setFailed(true)} />
}

export function StorefrontPreview({ draft, logoUrl, bannerUrl, fullPage = false }: StorefrontPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const store = draft.storefront
  const storeName = store.storeName.trim() || draft.business.businessName.trim() || 'Your local store'
  const initials = storeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    applyStoreTheme(
      {
        primaryColor: store.primaryColor,
        accentColor: store.accentColor,
        backgroundColor: store.backgroundColor,
        fontFamily: store.fontFamily,
      },
      root,
    )
    const previewBackground = normalizeHex(store.backgroundColor, '#f9fafb')
    root.style.setProperty('--store-bg', previewBackground)
    root.setAttribute(
      'data-store-mode',
      bestContrastText(previewBackground) === '#ffffff' ? 'dark' : 'light',
    )
    root.style.setProperty('--store-ink', normalizeHex(store.textColor, '#111827'))
    root.style.setProperty('--primary-foreground', bestContrastText(store.primaryColor))
    root.style.setProperty(
      '--onboarding-button-radius',
      store.buttonShape === 'PILL' ? '999px' : store.buttonShape === 'SQUARE' ? '0.25rem' : '0.75rem',
    )
    root.style.setProperty(
      '--onboarding-card-shadow',
      store.cardStyle === 'SHADOW' ? '0 10px 24px rgba(15,23,42,.12)' : 'none',
    )
    root.setAttribute('data-onboarding-preview', 'true')
    return () => {
      clearStoreTheme(root)
      root.style.removeProperty('--store-ink')
      root.style.removeProperty('--onboarding-button-radius')
      root.style.removeProperty('--onboarding-card-shadow')
      root.removeAttribute('data-onboarding-preview')
    }
  }, [store.accentColor, store.backgroundColor, store.buttonShape, store.cardStyle, store.fontFamily, store.primaryColor, store.textColor])

  // Every selected product, always. The preview used to cap at two because it had to
  // fit a fixed height with nothing scrolling — which meant a vendor with eight products
  // was shown two and had no way to check the rest. The screen scrolls now, as it does
  // in design-reference/onboarding.html, so there is nothing left to cap.
  const products = useMemo(
    () => draft.products.map((product) => {
      const productSkus = draft.skus.filter((sku) => sku.productId === product.id)
      return {
        ...product,
        price: productSkus.find(
          (sku) => sku.active && validateDraftSku(sku, productSkus).length === 0,
        )?.salePrice,
      }
    }),
    [draft.products, draft.skus],
  )
  const trustBadges = store.trustStrip.filter((badge) => badge.enabled)

  const content = (
    <>
      {store.announcementBar.trim() ? (
        <div className={cn(
          'shrink-0 bg-[var(--store-theme)] text-center font-semibold text-[var(--primary-foreground)]',
          fullPage ? 'px-4 py-2 text-xs' : 'truncate px-3 py-1.5 text-[10px] leading-4',
        )}>
          {store.announcementBar}
        </div>
      ) : null}

      {/* Storefront top bar. The reference opens with one, and without it the hero
          reads as a banner on a web page rather than a shop on a phone. */}
      {!fullPage ? (
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--store-border)] bg-[var(--store-panel)] px-3 py-2.5">
          <MenuIcon className="size-4 text-[var(--store-ink)]" aria-hidden="true" />
          <span className="truncate px-2 font-display text-[11px] font-bold text-[var(--store-ink)]">{storeName}</span>
          <ShoppingBagIcon className="size-4 text-[var(--store-theme)]" aria-hidden="true" />
        </div>
      ) : null}

      <div className={cn('relative shrink-0 overflow-hidden', fullPage ? 'h-72' : 'h-36')}>
        {bannerUrl ? (
          <img src={bannerUrl} alt="Store banner preview" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-[linear-gradient(135deg,var(--store-theme),var(--store-accent))]" />
        )}
        {/* Only as much scrim as the name needs to stay legible. A photo needs a real
            one; the brand gradient already contrasts with white, and burying it under
            the same wash just turns the hero muddy. */}
        <div className={cn('absolute inset-0 bg-gradient-to-t', bannerUrl ? 'from-slate-950/75 via-slate-950/15 to-transparent' : 'from-slate-950/35 to-transparent')} />
        <div className={cn('absolute inset-x-0 bottom-0 flex items-end', fullPage ? 'mx-auto max-w-6xl gap-3 px-6 pb-7' : 'gap-2.5 p-3')}>
          <div className={cn(
            'grid shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-white/80 bg-white font-display font-bold text-[var(--store-theme)] shadow-lg',
            fullPage ? 'size-14 text-lg' : 'size-11 text-sm',
          )}>
            {logoUrl ? (
              <img src={logoUrl} alt="Store logo preview" className="size-full object-cover" />
            ) : initials}
          </div>
          <div className="min-w-0 text-white">
            <h2 className={cn('truncate font-display font-bold', fullPage ? 'text-3xl' : 'text-[15px] leading-tight')}>
              {storeName}
            </h2>
            <p className={cn('truncate text-white/85', fullPage ? 'text-xs' : 'text-[11px]')}>
              {store.tagline.trim() || 'Your neighbourhood shop, ready for orders'}
            </p>
          </div>
        </div>
      </div>

      {/* The reference puts the order button directly under the hero, where it is the
          first thing a customer sees. */}
      {!fullPage ? (
        <div className="shrink-0 bg-[var(--store-panel)] px-3 py-2.5">
          <button
            type="button"
            tabIndex={-1}
            className="flex w-full items-center justify-center gap-1.5 rounded-[var(--onboarding-button-radius)] bg-[var(--store-theme)] px-3 py-2 text-[12px] font-semibold text-[var(--primary-foreground)]"
          >
            <MessageCircleIcon className="size-3.5" aria-hidden="true" /> Order on WhatsApp
          </button>
        </div>
      ) : null}

      <div className={cn(
        fullPage
          ? 'mx-auto max-w-6xl space-y-5 px-6 py-8'
          : 'space-y-3.5 p-3',
      )}>
        {store.welcomeMessage.trim() ? (
          <div className={cn(
            'rounded-xl border border-[var(--store-border)] bg-[var(--store-panel)] shadow-[var(--onboarding-card-shadow)]',
            fullPage ? 'p-3 text-sm' : 'p-2.5 text-[11px] leading-5',
          )}>
            {store.welcomeMessage}
          </div>
        ) : null}

        <section aria-labelledby="preview-categories">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="preview-categories" className={cn('font-display font-bold', fullPage ? 'text-sm' : 'text-[13px]')}>Browse categories</h3>
            <span className={cn('text-[var(--store-muted)]', fullPage ? 'text-[11px]' : 'text-[10px]')}>{draft.categories.length || 0} selected</span>
          </div>
          {draft.categories.length ? (
            <div className={cn('flex flex-wrap', fullPage ? 'gap-2' : 'gap-1.5')}>
              {draft.categories.map((category) => (
                <span key={category.id} className={cn('rounded-full border border-[var(--store-border)] bg-[var(--store-panel)] font-medium', fullPage ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]')}>
                  {category.name}
                </span>
              ))}
            </div>
          ) : (
            <span className={cn('text-[var(--store-muted)]', fullPage ? 'text-xs' : 'text-[11px]')}>Your categories will appear here.</span>
          )}
        </section>

        <section aria-labelledby="preview-products">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="preview-products" className={cn('font-display font-bold', fullPage ? 'text-sm' : 'text-[13px]')}>Our products</h3>
            <span className={cn('text-[var(--store-muted)]', fullPage ? 'text-[11px]' : 'text-[10px]')}>
              {products.length ? `${products.length} listed` : 'Order direct'}
            </span>
          </div>
          {products.length ? (
            <div className={cn('grid gap-2', fullPage ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2')}>
              {products.map((product) => (
                <article
                  key={product.id}
                  className={cn(
                    'overflow-hidden rounded-xl bg-[var(--store-panel)] shadow-[var(--onboarding-card-shadow)]',
                    store.cardStyle === 'BORDER' && 'border border-[var(--store-border)]',
                  )}
                >
                  <PreviewImage src={product.imageUrl} alt={product.name} className={cn('w-full', fullPage ? 'h-36' : 'h-20')} />
                  <div className={cn(fullPage ? 'p-2.5' : 'p-2')}>
                    <h4 className={cn('truncate font-semibold', fullPage ? 'text-xs' : 'text-[11px]')}>{product.name}</h4>
                    <p className={cn('font-bold text-[var(--store-theme)]', fullPage ? 'mt-1 text-xs' : 'mt-0.5 text-[11px]')}>
                      {product.price ? `₹${product.price.toLocaleString('en-IN')}` : 'Price coming soon'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={cn('rounded-xl border border-dashed border-[var(--store-border)] text-center text-[var(--store-muted)]', fullPage ? 'p-5 text-xs' : 'p-4 text-[11px]')}>
              Products and prices will appear as you add them.
            </div>
          )}
        </section>

        {trustBadges.length ? (
          <div className={cn('grid grid-cols-2', fullPage ? 'gap-2 text-[11px]' : 'gap-1.5 text-[10px] leading-4')}>
            {trustBadges.map((badge) => (
              <div key={badge.id} className={cn('rounded-xl border border-[var(--store-border)] bg-[var(--store-panel)]', fullPage ? 'p-2.5' : 'p-2')}>
                <strong className="block">{badge.title}</strong>
                <span className="text-[var(--store-muted)]">{badge.subtitle}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className={cn('border-t border-[var(--store-border)] text-[var(--store-muted)]', fullPage ? 'space-y-2 pt-4 text-xs' : 'space-y-2 pt-3 text-[11px]')}>
          <p className="flex items-center gap-1.5 truncate">
            <MapPinIcon className={cn('shrink-0', fullPage ? 'size-3.5' : 'size-3')} />
            {store.businessLocation.trim() || 'Your business location'}
          </p>
          {fullPage ? (
            <button type="button" className="flex w-full items-center justify-center gap-2 rounded-[var(--onboarding-button-radius)] bg-[var(--store-theme)] px-4 py-3 font-semibold text-[var(--primary-foreground)]">
              <MessageCircleIcon className="size-4" /> Order on WhatsApp
            </button>
          ) : (
            <p className="text-center text-[10px]">Powered by MithraDirect</p>
          )}
        </div>
      </div>
    </>
  )

  if (fullPage) {
    return (
      <div className="mx-auto min-h-[100dvh] w-full">
        <div ref={rootRef} aria-label="Storefront preview" className="min-h-[100dvh] bg-[var(--store-bg)] font-sans text-[var(--store-ink)]">
          {content}
        </div>
      </div>
    )
  }

  // Device frame, following the reference: a 10px bezel, a notch, and a screen that
  // scrolls. The frame owns the shadow; the screen owns the overflow.
  return (
    <div className="onboarding-phone relative mx-auto">
      <div
        ref={rootRef}
        aria-label="Storefront preview"
        className="h-full overflow-x-hidden overflow-y-auto overscroll-contain bg-[var(--store-bg)] font-sans text-[var(--store-ink)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {content}
      </div>
    </div>
  )
}
