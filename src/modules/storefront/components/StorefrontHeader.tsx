import { useEffect, useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, ChevronLeft, LogOut, Menu, Search, ShoppingCart, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canShopAsCustomer } from '@/modules/storefront/lib/request-add-to-cart'
import { customerLoginLink, linkFromNavTarget, visibleCartCount } from '@/modules/storefront/lib/cart-nav'
import { storeContactHeaderProps } from '@/modules/storefront/lib/store-contact'
import {
  storeBackFallback,
  storeCartPath,
  storeOrdersPath,
  storePath,
  storeSearchPath,
  storefrontActiveNav,
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

function storeNav(storeId: string | null) {
  return [
    { id: 'home', label: 'Home' },
    { id: 'categories', label: 'Categories' },
    { id: 'orders', label: 'Track Order', href: storeId ? storeOrdersPath(storeId) : '/orders' },
  ] as const
}

type StorefrontHeaderProps = {
  store?: Store | null
  /** When the shop record is still loading. */
  storeId?: string
  /** Fallback name while the shop record is still loading. */
  storeName?: string
  cartCount?: number
  activeNav?: string
  searchOpen?: boolean
  /** Shop home only. Other pages open the shop search. */
  onToggleSearch?: () => void
  /** Shop home only. Other pages go to the shop. */
  onNavClick?: (id: string) => void
  /** Shop home only. Other pages go to the shop. */
  onBrowseMenu?: () => void
}

function NavItem({
  active,
  label,
  onClick,
  href,
}: {
  active: boolean
  label: string
  onClick?: () => void
  href?: string
}) {
  const className = cn(
    'relative px-3.5 py-2 text-[13px] font-semibold transition-colors lg:px-4 lg:text-sm',
    active ? 'text-[var(--store-theme,var(--md-green-700))]' : 'text-slate-600 hover:text-slate-900',
  )

  const inner = (
    <>
      {label}
      {active ? (
        <span
          className="absolute bottom-0 left-3.5 right-3.5 h-[2px] rounded-full bg-[var(--store-theme,var(--md-green-600))] lg:left-4 lg:right-4"
          aria-hidden
        />
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link to={href} className={className} aria-current={active ? 'page' : undefined}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  )
}

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
    <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
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

      <Link
        to={ordersHref}
        className="inline-flex size-11 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 lg:hidden"
        aria-label="Track order"
        title="Track order"
      >
        <ClipboardList className="size-[1.125rem]" strokeWidth={1.75} />
      </Link>

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

function StoreMenuDrawer({
  open,
  onClose,
  storeName,
  logoUrl,
  storeId,
  cartHref,
  contactHref,
  contactActive,
  onHome,
  onBrowseMenu,
}: {
  open: boolean
  onClose: () => void
  storeName: string
  logoUrl?: string
  storeId: string | null
  cartHref: string
  contactHref?: string
  contactActive?: boolean
  onHome?: () => void
  onBrowseMenu?: () => void
}) {
  const titleId = useId()
  const homeHref = storeId ? storePath(storeId) : '/'
  const cartTo = cartHref || (storeId ? storeCartPath(storeId) : '/cart')

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const linkClass =
    'flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50'

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100%-2.5rem))] flex-col bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div id={titleId} className="min-w-0">
            <StoreBrandLogo storeName={storeName} logoUrl={logoUrl} variant="full" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Store menu">
          <Link to={homeHref} className={linkClass} onClick={() => { onHome?.(); onClose() }}>
            Home
          </Link>
          {onBrowseMenu ? (
            <button
              type="button"
              className={linkClass}
              onClick={() => {
                onBrowseMenu()
                onClose()
              }}
            >
              Menu
            </button>
          ) : (
            <Link to={homeHref} className={linkClass} onClick={onClose}>
              Menu
            </Link>
          )}
          <Link to={cartTo} className={linkClass} onClick={onClose}>
            Cart
          </Link>
          {contactHref ? (
            <Link
              to={contactHref}
              className={cn(
                linkClass,
                contactActive && 'bg-emerald-50 text-[var(--store-theme,var(--md-green-700))]',
              )}
              aria-current={contactActive ? 'page' : undefined}
              onClick={onClose}
            >
              Contact us
            </Link>
          ) : null}
        </nav>
      </aside>
    </div>
  )
}

const LOGO_WRAP =
  'flex min-w-0 flex-1 items-center overflow-hidden lg:min-w-[220px] lg:flex-none'

function ShopLogo({
  storeName,
  logoUrl,
  shopHref,
  onHome,
}: {
  storeName: string
  logoUrl?: string
  shopHref: string
  onHome?: () => void
}) {
  const mark = (
    <StoreBrandLogo
      storeName={storeName}
      logoUrl={logoUrl}
      variant="full"
      className="[&_p:first-child]:text-sm [&_p:first-child]:sm:text-base"
    />
  )
  if (onHome) {
    return (
      <a href="#top" className={LOGO_WRAP} onClick={onHome}>
        {mark}
      </a>
    )
  }
  return (
    <Link to={shopHref} className={LOGO_WRAP}>
      {mark}
    </Link>
  )
}

/** Shop header — pass `store`. Only the shop home overrides search/nav. */
export function StorefrontHeader({
  store,
  storeId: storeIdProp,
  storeName: storeNameProp,
  cartCount = 0,
  activeNav = 'home',
  searchOpen = false,
  onToggleSearch,
  onNavClick,
  onBrowseMenu,
}: StorefrontHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const shopId = store?.id ?? storeIdProp
  const storeName = store?.name ?? storeNameProp ?? 'Store'
  const logoUrl = store?.theme?.logoImage
  const cartHref = shopId ? storeCartPath(shopId) : '/cart'
  const shopHref = shopId ? storePath(shopId) : '/'
  const navId = storefrontActiveNav(location.pathname, activeNav)
  const contactActive = navId === 'contact'
  const { contactHref, orderWhatsappHref } = storeContactHeaderProps(store)
  const [menuOpen, setMenuOpen] = useState(false)
  const backTo = storeBackFallback(`${location.pathname}${location.search}`)

  function goToShop() {
    if (shopId) navigate(storePath(shopId))
  }

  const handleSearch =
    onToggleSearch ??
    (() => {
      if (shopId) navigate(storeSearchPath(shopId))
    })
  const handleNav = onNavClick ?? ((id: string) => {
    if (id === 'home' || id === 'categories') goToShop()
  })
  const handleBrowse = onBrowseMenu ?? goToShop

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="store-shell-inner overflow-visible">
        <div className="flex h-16 min-w-0 items-center gap-2 sm:gap-3 lg:h-[4.5rem] lg:gap-6">
          {backTo ? (
            <Link
              to={backTo}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
              aria-label="Go back"
            >
              <ChevronLeft className="size-6" strokeWidth={1.75} />
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" strokeWidth={1.75} />
            </button>
          )}

          <ShopLogo
            storeName={storeName}
            logoUrl={logoUrl}
            shopHref={shopHref}
            onHome={onNavClick ? () => onNavClick('home') : undefined}
          />

          <nav
            className="hidden flex-1 items-center justify-center lg:flex"
            aria-label="Store navigation"
          >
            <div className="flex items-center gap-0.5">
              {storeNav(shopId ?? null).map((item) => (
                <NavItem
                  key={item.id}
                  active={navId === item.id}
                  label={item.label}
                  href={'href' in item ? item.href : undefined}
                  onClick={'href' in item ? undefined : () => handleNav(item.id)}
                />
              ))}
            </div>
          </nav>

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

      <StoreMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        storeName={storeName}
        logoUrl={logoUrl}
        storeId={shopId ?? null}
        cartHref={cartHref}
        contactHref={contactHref}
        contactActive={contactActive}
        onHome={() => handleNav('home')}
        onBrowseMenu={handleBrowse}
      />
    </header>
  )
}
