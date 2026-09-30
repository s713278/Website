import { useEffect } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { StorePageFooter } from '@/modules/storefront/components/StorePageFooter'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { storeCartPath, storeOrderPath, storeOrdersPath, storePath, storeSearchPath } from '@/modules/storefront/lib/store-paths'
import { readWhatsAppOrderDraft, whatsappHref } from '@/modules/storefront/lib/whatsapp-order'

type SuccessState = {
  storeName?: string
  whatsappMessage?: string
  whatsappHref?: string
}

export function OrderSuccessPage() {
  const { storeId = '', orderId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as SuccessState | null) ?? {}
  const { store, wrapperRef } = useStorePage(storeId, { network: 'cache-only' })
  const clearVendor = useCartStore((s) => s.clearVendor)

  useEffect(() => {
    if (storeId) clearVendor(storeId)
  }, [storeId, clearVendor])

  const message = state.whatsappMessage || readWhatsAppOrderDraft(orderId)
  const waHref =
    state.whatsappHref || (message ? whatsappHref(store?.phone ?? '', message) : '')
  const storeName = state.storeName ?? store?.name ?? 'Store'

  if (!storeId || !orderId) return <Navigate to="/orders" replace />

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      <StorefrontHeader
        storeName={storeName}
        logoUrl={store?.theme?.logoImage}
        cartHref={storeCartPath(storeId)}
        searchOpen={false}
        onToggleSearch={() => navigate(storeSearchPath(storeId))}
        pageTitle="Order created"
        onBack={() => navigate(storeOrdersPath(storeId))}
      />

      <main className="store-shell-inner flex-1 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-10 lg:py-14">
        <div className="mx-auto w-full max-w-md text-center sm:max-w-lg sm:rounded-3xl sm:border sm:border-slate-100 sm:bg-white sm:px-8 sm:py-10 sm:shadow-sm">
          <span className="md-pop-in mx-auto inline-flex size-16 items-center justify-center rounded-full border border-emerald-200 bg-[var(--store-theme-soft,rgba(16,185,129,0.16))] text-[var(--store-theme,var(--md-green-700))] sm:size-[4.5rem]">
            <Check className="size-8 sm:size-9" strokeWidth={2.5} aria-hidden />
          </span>
          <h1 className="font-display mt-4 text-[1.35rem] font-bold leading-tight text-slate-900 sm:mt-5 sm:text-2xl">
            Order Created Successfully!
          </h1>
          <p className="mt-4 text-xs text-slate-500 sm:mt-5 sm:text-sm">Order ID</p>
          <p className="mt-1 break-all text-lg font-bold tracking-wide text-[var(--store-theme,var(--md-green-800))] sm:text-xl">
            {orderId}
          </p>

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--store-theme,var(--md-green-800))] px-3 py-3 text-sm font-semibold text-white hover:opacity-90 sm:mt-8 sm:px-5 sm:text-[15px]"
            >
              <WhatsAppIcon />
              <span className="min-w-0 text-balance">Send Order on WhatsApp</span>
            </a>
          ) : null}

          <div className="mt-4 flex flex-col items-center gap-1 sm:mt-5 sm:gap-2">
            <Link
              to={storeOrderPath(storeId, orderId)}
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
            >
              View Order Details
            </Link>
            <Link
              to={storePath(storeId)}
              className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>

      {store ? <StorePageFooter store={store} /> : null}
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
