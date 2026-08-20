import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2Icon, MapPinIcon, MessageCircleIcon, ShoppingBagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { applyStoreTheme, clearStoreTheme, normalizeHex } from '@/shared/lib/theme'
import { bestContrastText, validateDraftSku } from '../../lib/onboarding-validation'
import type {
  PaymentType,
  VendorOnboardingDraftV1,
} from '../../types/onboarding'

type StorefrontPreviewProps = {
  draft: VendorOnboardingDraftV1
  logoUrl: string | null
  bannerUrl: string | null
  fullPage?: boolean
}

const PAYMENT_LABELS: Record<PaymentType, string> = {
  PRE_PAID: 'UPI',
  ONLINE: 'Bank account',
  CASH_ON_DELIVERY: 'Cash on Delivery',
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

  const products = useMemo(
    () => draft.products.slice(0, fullPage ? 12 : 2).map((product) => {
      const productSkus = draft.skus.filter((sku) => sku.productId === product.id)
      return {
        ...product,
        price: productSkus.find(
          (sku) => sku.active && validateDraftSku(sku, productSkus).length === 0,
        )?.salePrice,
      }
    }),
    [draft.products, draft.skus, fullPage],
  )
  const enabledPayments = draft.payments.filter((payment) => payment.enabled)
  const fulfillmentLabel =
    draft.delivery.fulfillmentType === 'BOTH'
      ? 'Delivery & pickup'
      : draft.delivery.fulfillmentType === 'STORE_PICKUP'
        ? 'Store pickup'
        : 'Home delivery'

  return (
    <div
      className={cn(
        'mx-auto overflow-hidden bg-slate-950',
        fullPage
          ? 'min-h-[100dvh] w-full bg-transparent shadow-none'
          : 'aspect-[1/2] h-full max-h-full max-w-full rounded-[1.65rem] border-[5px] border-slate-950 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.8)]',
      )}
    >
      <div
        ref={rootRef}
        aria-label="Storefront preview"
        className={cn(
          'bg-[var(--store-bg)] font-sans text-[var(--store-ink)]',
          fullPage ? 'min-h-[100dvh]' : 'flex h-full flex-col overflow-hidden',
        )}
      >
        {store.announcementBar.trim() ? (
          <div className={cn(
            'shrink-0 bg-[var(--store-theme)] text-center font-semibold text-[var(--primary-foreground)]',
            fullPage ? 'px-4 py-2 text-xs' : 'truncate px-3 py-1 text-[9px] leading-4',
          )}>
            {store.announcementBar}
          </div>
        ) : null}

        <div className={cn('relative shrink-0 overflow-hidden', fullPage ? 'h-72' : 'h-[104px]')}>
          {bannerUrl ? (
            <img src={bannerUrl} alt="Store banner preview" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-[linear-gradient(135deg,var(--store-theme),var(--store-accent))]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
          <div className={cn('absolute inset-x-0 bottom-0 flex items-end', fullPage ? 'mx-auto max-w-6xl gap-3 px-6 pb-7' : 'gap-2 p-3')}>
            <div className={cn(
              'grid shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-white/80 bg-white font-display font-bold text-[var(--store-theme)] shadow-lg',
              fullPage ? 'size-14 text-lg' : 'size-10 text-sm',
            )}>
              {logoUrl ? (
                <img src={logoUrl} alt="Store logo preview" className="size-full object-cover" />
              ) : initials}
            </div>
            <div className="min-w-0 text-white">
              <h2 className={cn('truncate font-display font-bold', fullPage ? 'text-3xl' : 'text-sm')}>
                {storeName}
              </h2>
              <p className={cn('truncate text-white/85', fullPage ? 'text-xs' : 'text-[9px]')}>
                {store.tagline.trim() || 'Your neighbourhood shop, ready for orders'}
              </p>
            </div>
          </div>
        </div>

        <div className={cn(
          fullPage
            ? 'mx-auto max-w-6xl space-y-5 px-6 py-8'
            : 'flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3',
        )}>
          <div className={cn('flex overflow-hidden', fullPage ? 'flex-wrap gap-2 text-[11px]' : 'shrink-0 gap-1.5 whitespace-nowrap text-[9px]')}>
            {draft.business.businessType ? (
              <span className={cn('shrink-0 rounded-full border border-[var(--store-border)] bg-[var(--store-panel)] font-semibold', fullPage ? 'px-2.5 py-1' : 'px-2 py-0.5')}>
                {draft.business.businessType.name}
              </span>
            ) : null}
            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--store-theme-soft)] font-semibold text-[var(--store-theme)]', fullPage ? 'px-2.5 py-1' : 'px-2 py-0.5')}>
              <CheckCircle2Icon className="size-3" /> {fulfillmentLabel}
            </span>
            {enabledPayments.slice(0, fullPage ? 2 : 1).map((payment) => (
              <span key={payment.type} className={cn('shrink-0 rounded-full bg-[var(--store-accent-soft)] font-semibold text-[var(--store-ink)]', fullPage ? 'px-2.5 py-1' : 'px-2 py-0.5')}>
                {PAYMENT_LABELS[payment.type]}
              </span>
            ))}
            {store.heroBadges.slice(0, fullPage ? 3 : 1).map((badge, index) => badge.trim() ? (
              <span key={`${badge}-${index}`} className={cn('shrink-0 rounded-full border border-[var(--store-border)] bg-[var(--store-panel)] font-semibold', fullPage ? 'px-2.5 py-1' : 'px-2 py-0.5')}>
                {badge}
              </span>
            ) : null)}
          </div>

          {store.welcomeMessage.trim() ? (
            <div className={cn(
              'rounded-xl border border-[var(--store-border)] bg-[var(--store-panel)] shadow-[var(--onboarding-card-shadow)]',
              fullPage ? 'p-3 text-sm' : 'line-clamp-2 shrink-0 p-2 text-[9px] leading-4',
            )}>
              {store.welcomeMessage}
            </div>
          ) : null}

          <section className="shrink-0" aria-labelledby="preview-categories">
            <div className={cn('flex items-center justify-between', fullPage ? 'mb-2' : 'mb-1')}>
              <h3 id="preview-categories" className={cn('font-display font-bold', fullPage ? 'text-sm' : 'text-[10px]')}>Browse categories</h3>
              <span className={cn('text-[var(--store-muted)]', fullPage ? 'text-[11px]' : 'text-[9px]')}>{draft.categories.length || 0} selected</span>
            </div>
            <div className={cn('flex overflow-hidden', fullPage ? 'gap-2' : 'gap-1.5')}>
              {draft.categories.length ? draft.categories.slice(0, fullPage ? undefined : 3).map((category) => (
                <span key={category.id} className={cn('shrink-0 rounded-full border border-[var(--store-border)] bg-[var(--store-panel)] font-medium', fullPage ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[9px]')}>
                  {category.name}
                </span>
              )) : (
                <span className={cn('text-[var(--store-muted)]', fullPage ? 'text-xs' : 'text-[9px]')}>Your categories will appear here.</span>
              )}
            </div>
          </section>

          <section className={cn(!fullPage && 'min-h-0 shrink-0')} aria-labelledby="preview-products">
            <div className={cn('flex items-center justify-between', fullPage ? 'mb-2' : 'mb-1')}>
              <h3 id="preview-products" className={cn('font-display font-bold', fullPage ? 'text-sm' : 'text-[10px]')}>Featured products</h3>
              <span className={cn('text-[var(--store-muted)]', fullPage ? 'text-[11px]' : 'text-[9px]')}>Order direct</span>
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
                    <PreviewImage src={product.imageUrl} alt={product.name} className={cn('w-full', fullPage ? 'h-36' : 'h-12')} />
                    <div className={cn(fullPage ? 'p-2.5' : 'p-1.5')}>
                      <h4 className={cn('truncate font-semibold', fullPage ? 'text-xs' : 'text-[9px]')}>{product.name}</h4>
                      <p className={cn('font-bold text-[var(--store-theme)]', fullPage ? 'mt-1 text-xs' : 'mt-0.5 text-[9px]')}>
                        {product.price ? `₹${product.price.toLocaleString('en-IN')}` : 'Price coming soon'}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={cn('rounded-xl border border-dashed border-[var(--store-border)] text-center text-[var(--store-muted)]', fullPage ? 'p-5 text-xs' : 'p-3 text-[9px]')}>
                Products and prices will appear as you add them.
              </div>
            )}
          </section>

          <div className={cn('grid shrink-0 grid-cols-2', fullPage ? 'gap-2 text-[11px]' : 'gap-1.5 text-[8px] leading-3')}>
            {store.trustStrip.filter((badge) => badge.enabled).slice(0, 2).map((badge) => (
              <div key={badge.id} className={cn('rounded-xl border border-[var(--store-border)] bg-[var(--store-panel)]', fullPage ? 'p-2.5' : 'p-1.5')}>
                <strong className="block">{badge.title}</strong>
                <span className="text-[var(--store-muted)]">{badge.subtitle}</span>
              </div>
            ))}
          </div>

          <div className={cn('mt-auto shrink-0 border-t border-[var(--store-border)] text-[var(--store-muted)]', fullPage ? 'space-y-2 pt-4 text-xs' : 'space-y-1 pt-2 text-[9px]')}>
            <p className={cn('flex items-center truncate', fullPage ? 'gap-2' : 'gap-1')}><MapPinIcon className={cn(fullPage ? 'size-3.5' : 'size-3')} />{store.businessLocation.trim() || 'Your business location'}</p>
            <button type="button" className={cn('flex w-full items-center justify-center rounded-[var(--onboarding-button-radius)] bg-[var(--store-theme)] font-semibold text-[var(--primary-foreground)]', fullPage ? 'gap-2 px-4 py-3' : 'gap-1.5 px-3 py-1.5')}>
              <MessageCircleIcon className={cn(fullPage ? 'size-4' : 'size-3')} /> Order on WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
