import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Phone, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canShopAsCustomer } from '@/app/router/role-home'
import { canHoldCart, customerLoginLink } from '@/modules/storefront/lib/cart-nav'
import { storeContactHeaderProps } from '@/modules/storefront/lib/store-contact'
import {
  isStoreContactPath,
  storeBackFallback,
  storeCartPath,
  storeOrdersPath,
  storeContactPath,
  storePath,
  storeSearchPath,
} from '@/modules/storefront/lib/store-paths'
import { isLiveApi } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type { Store } from '@/modules/storefront/types'
import { AccountMenu, CartButton, HeaderButton } from '@/shared/components'
import { StoreBrandLogo } from './StoreBrandLogo'

type StorefrontHeaderProps = {
  store?: Store | null
  /** When the shop record is still loading. */
  storeId?: string
  /** Fallback name while the shop record is still loading. */
  storeName?: string
  storeLoading?: boolean
  cartCount?: number
  searchOpen?: boolean
  /** Shop home only. Other pages open the shop search. */
  onToggleSearch?: () => void
  onBack?: () => void
}

const BACK_BUTTON_CLASS =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100'

function ContactUsLink({ href, active }: { href: string; active: boolean }) {
  return (
    <Link
      to={href}
      aria-current={active ? 'page' : undefined}
      aria-label="Contact us"
      // Below sm an icon, so the shop name keeps its room beside Sign in.
      className={cn(
        'relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition sm:w-auto sm:px-3.5',
        active
          ? 'bg-[var(--store-theme,var(--md-green-800))] text-white ring-2 ring-[var(--store-theme,var(--md-green-700))]/35 ring-offset-2 ring-offset-white'
          : 'bg-[var(--store-theme,var(--md-green-700))] text-white hover:opacity-90',
      )}
    >
      <Phone className="size-[1.125rem] sm:hidden" strokeWidth={1.75} aria-hidden />
      <span className="hidden sm:inline">Contact us</span>
    </Link>
  )
}

function AccountControl({
  loginTo,
  loginState,
  ordersHref,
}: {
  loginTo: string
  loginState: { from: string; shopName?: string; shopLogoUrl?: string }
  ordersHref: string
}) {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const from = `${location.pathname}${location.search}`
  const signInState = { ...loginState, from }

  if (!canShopAsCustomer(user)) {
    return (
      <HeaderButton to={loginTo} state={signInState} emphasis="secondary">
        Sign in
      </HeaderButton>
    )
  }

  return <AccountMenu ordersHref={ordersHref} />
}

function HeaderActions({
  contact,
  searchOpen,
  onToggleSearch,
  cartCount = 0,
  cartHref = '/cart',
  storeId,
  storeName,
  logoUrl,
}: {
  contact: ReactNode
  searchOpen: boolean
  onToggleSearch: () => void
  cartCount?: number
  cartHref?: string
  storeId?: string | null
  storeName?: string
  logoUrl?: string
}) {
  const user = useAuthStore((s) => s.user)
  const shop = { name: storeName, logoUrl }
  const ordersHref = storeId ? storeOrdersPath(storeId) : '/orders'
  const login = customerLoginLink(storeId ? storePath(storeId) : '/', shop)
  const account = (
    <AccountControl loginTo={login.to} loginState={login.state} ordersHref={ordersHref} />
  )
  // Search first and the cart last. Sign in sits before Contact us; the account menu, an icon
  // like the cart, sits after it.
  const signedIn = canShopAsCustomer(user)

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
      <button
        type="button"
        onClick={onToggleSearch}
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-full text-slate-700 transition',
          searchOpen ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-100',
        )}
        aria-label={searchOpen ? 'Close search' : 'Search products'}
        aria-pressed={searchOpen}
      >
        <Search className="size-[1.125rem]" strokeWidth={1.75} />
      </button>

      {signedIn ? null : account}
      {contact}
      {signedIn ? account : null}

      {/* A live guest or vendor session cannot hold a cart; Sign in beside it is their way in. */}
      {canHoldCart(user) ? <CartButton to={cartHref} count={cartCount} /> : null}
    </div>
  )
}

/** Shop header — pass `store`. Only the shop home overrides search. */
export function StorefrontHeader({
  store,
  storeId: storeIdProp,
  storeName: storeNameProp,
  storeLoading = false,
  cartCount = 0,
  searchOpen = false,
  onToggleSearch,
  onBack,
}: StorefrontHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const shopId = store?.id ?? storeIdProp
  const storeName = store?.name ?? storeNameProp ?? 'Store'
  const logoUrl = store?.theme?.logoImage
  const cartHref = shopId ? storeCartPath(shopId) : '/cart'
  const shopHref = shopId ? storePath(shopId) : '/'
  const contactActive = isStoreContactPath(location.pathname)
  const { contactHref } = storeContactHeaderProps(store)
  const publishedContactHref =
    contactHref ?? (shopId && isLiveApi() ? storeContactPath(shopId) : undefined)
  const backTo = storeBackFallback(`${location.pathname}${location.search}`)

  const handleSearch =
    onToggleSearch ??
    (() => {
      if (shopId) navigate(storeSearchPath(shopId))
    })

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="store-shell-inner overflow-visible">
        <div className="flex h-16 min-w-0 items-center gap-2 sm:gap-3 lg:h-[4.5rem] lg:gap-6">
          {searchOpen ? (
            <button
              type="button"
              onClick={handleSearch}
              className={BACK_BUTTON_CLASS}
              aria-label="Go back"
            >
              <ChevronLeft className="size-6" strokeWidth={1.75} />
            </button>
          ) : onBack ? (
            <button
              type="button"
              onClick={onBack}
              className={BACK_BUTTON_CLASS}
              aria-label="Go back"
            >
              <ChevronLeft className="size-6" strokeWidth={1.75} />
            </button>
          ) : backTo ? (
            <Link to={backTo} className={BACK_BUTTON_CLASS} aria-label="Go back">
              <ChevronLeft className="size-6" strokeWidth={1.75} />
            </Link>
          ) : null}

          <Link
            to={shopHref}
            onClick={(event) => {
              if (!onBack) return
              event.preventDefault()
              onBack()
            }}
            className="flex min-w-0 flex-1 items-center overflow-hidden lg:min-w-[220px] lg:flex-none"
          >
            <StoreBrandLogo
              storeName={storeName}
              logoUrl={logoUrl}
              pending={storeLoading && !logoUrl}
              variant="full"
              // Below sm the actions leave the name ~85px, so it wraps to two lines before truncating.
              className="[&_p:first-child]:max-sm:line-clamp-2 [&_p:first-child]:max-sm:whitespace-normal [&_p:first-child]:max-sm:break-words [&_p:first-child]:max-sm:text-[13px] [&_p:first-child]:sm:text-base"
            />
          </Link>

          <HeaderActions
            contact={
              publishedContactHref ? (
                <ContactUsLink href={publishedContactHref} active={contactActive} />
              ) : null
            }
            searchOpen={searchOpen}
            onToggleSearch={handleSearch}
            cartCount={cartCount}
            cartHref={cartHref}
            storeId={shopId}
            storeName={storeName}
            logoUrl={logoUrl}
          />
        </div>
      </div>
    </header>
  )
}
