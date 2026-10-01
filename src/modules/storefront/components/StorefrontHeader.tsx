import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, ChevronLeft, LogOut, Search, ShoppingCart, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canShopAsCustomer } from '@/modules/storefront/lib/request-add-to-cart'
import { customerLoginLink, linkFromNavTarget, visibleCartCount } from '@/modules/storefront/lib/cart-nav'
import { storeContactHeaderProps } from '@/modules/storefront/lib/store-contact'
import {
  isStoreContactPath,
  storeBackFallback,
  storeCartPath,
  storeOrdersPath,
  storePath,
  storeSearchPath,
} from '@/modules/storefront/lib/store-paths'
import { isLiveApi } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type { Store } from '@/modules/storefront/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components'
import { StoreBrandLogo } from './StoreBrandLogo'
import { WhatsAppIcon } from './WhatsAppIcon'

type StorefrontHeaderProps = {
  store?: Store | null
  /** When the shop record is still loading. */
  storeId?: string
  /** Fallback name while the shop record is still loading. */
  storeName?: string
  cartCount?: number
  searchOpen?: boolean
  /** Shop home only. Other pages open the shop search. */
  onToggleSearch?: () => void
}

const BACK_BUTTON_CLASS =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100'

function ContactUsLink({ href, active }: { href: string; active: boolean }) {
  return (
    <Link
      to={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-full px-3.5 text-sm font-semibold transition',
        active
          ? 'bg-[var(--store-theme,var(--md-green-800))] text-white ring-2 ring-[var(--store-theme,var(--md-green-700))]/35 ring-offset-2 ring-offset-white'
          : 'bg-[var(--store-theme,var(--md-green-700))] text-white hover:opacity-90',
      )}
    >
      Contact us
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
  const logout = useAuthStore((s) => s.logout)
  const from = `${location.pathname}${location.search}`
  const signInState = { ...loginState, from }

  if (!user) {
    return (
      <Link
        to={loginTo}
        state={signInState}
        className="inline-flex h-11 min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Sign in
      </Link>
    )
  }

  const name = user.name?.trim()
  const placeholder = !name || name === 'User' || name === 'Vendor'
  const label = placeholder
    ? user.phone
      ? `+91 ${user.phone}`
      : ''
    : name

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--store-theme,var(--md-green-600))]/40"
        aria-label="Account"
        title="Account"
      >
        <User className="size-[1.125rem]" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {label ? (
          <>
            <DropdownMenuLabel className="px-2 py-1.5">
              <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to={ordersHref}>
            <ClipboardList />
            My orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HeaderActions({
  searchOpen,
  onToggleSearch,
  cartCount = 0,
  cartHref = '/cart',
  storeId,
  storeName,
  logoUrl,
  orderWhatsappHref,
}: {
  searchOpen: boolean
  onToggleSearch: () => void
  cartCount?: number
  cartHref?: string
  storeId?: string | null
  storeName?: string
  logoUrl?: string
  orderWhatsappHref?: string
}) {
  const user = useAuthStore((s) => s.user)
  const badge = visibleCartCount(user, cartCount)
  const shop = { name: storeName, logoUrl }
  const ordersHref = storeId ? storeOrdersPath(storeId) : '/orders'
  const login = customerLoginLink(storeId ? storePath(storeId) : '/', shop)
  const cartLink = linkFromNavTarget(
    canShopAsCustomer(user) || !isLiveApi()
      ? cartHref
      : { pathname: login.to, state: login.state },
  )

  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
      <button
        type="button"
        onClick={onToggleSearch}
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-full text-slate-700 transition',
          searchOpen ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-100',
        )}
        aria-label={searchOpen ? 'Close search' : 'Search products'}
        aria-pressed={searchOpen}
      >
        <Search className="size-[1.125rem]" strokeWidth={1.75} />
      </button>

      {orderWhatsappHref ? (
        <a
          href={orderWhatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex size-11 items-center justify-center rounded-full text-[#25D366] transition hover:bg-emerald-50"
          aria-label="Order on WhatsApp"
          title="Order on WhatsApp"
        >
          <WhatsAppIcon className="size-6" />
        </a>
      ) : null}

      <AccountControl
        loginTo={login.to}
        loginState={login.state}
        ordersHref={ordersHref}
      />

      <Link
        to={cartLink.to}
        state={cartLink.state}
        className="relative inline-flex size-11 shrink-0 items-center justify-center overflow-visible rounded-full text-slate-700 transition hover:bg-slate-100"
        aria-label={`Cart${badge ? `, ${badge} items` : ''}`}
      >
        <ShoppingCart className="size-[1.125rem]" strokeWidth={1.75} />
        {badge > 0 ? (
          <span className="absolute right-1.5 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--store-theme,var(--md-green-600))] px-0.5 text-[9px] font-bold leading-none text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </Link>
    </div>
  )
}

/** Shop header — pass `store`. Only the shop home overrides search. */
export function StorefrontHeader({
  store,
  storeId: storeIdProp,
  storeName: storeNameProp,
  cartCount = 0,
  searchOpen = false,
  onToggleSearch,
}: StorefrontHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const shopId = store?.id ?? storeIdProp
  const storeName = store?.name ?? storeNameProp ?? 'Store'
  const logoUrl = store?.theme?.logoImage
  const cartHref = shopId ? storeCartPath(shopId) : '/cart'
  const shopHref = shopId ? storePath(shopId) : '/'
  const contactActive = isStoreContactPath(location.pathname)
  const { contactHref, orderWhatsappHref } = storeContactHeaderProps(store)
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
          ) : backTo ? (
            <Link to={backTo} className={BACK_BUTTON_CLASS} aria-label="Go back">
              <ChevronLeft className="size-6" strokeWidth={1.75} />
            </Link>
          ) : null}

          <Link
            to={shopHref}
            className="flex min-w-0 flex-1 items-center overflow-hidden lg:min-w-[220px] lg:flex-none"
          >
            <StoreBrandLogo
              storeName={storeName}
              logoUrl={logoUrl}
              variant="full"
              className="[&_p:first-child]:text-sm [&_p:first-child]:sm:text-base"
            />
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-6">
            {contactHref ? <ContactUsLink href={contactHref} active={contactActive} /> : null}
            <HeaderActions
              searchOpen={searchOpen}
              onToggleSearch={handleSearch}
              cartCount={cartCount}
              cartHref={cartHref}
              storeId={shopId}
              storeName={storeName}
              logoUrl={logoUrl}
              orderWhatsappHref={orderWhatsappHref}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
