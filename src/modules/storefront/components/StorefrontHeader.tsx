import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, ClipboardList, LogOut, Menu, Search, ShoppingCart, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canShopAsCustomer } from '@/modules/storefront/lib/request-add-to-cart'
import { customerLoginLink, linkFromNavTarget, visibleCartCount } from '@/modules/storefront/lib/cart-nav'
import { storeIdFromPath, storeOrdersPath, storePath } from '@/modules/storefront/lib/store-paths'
import { isLiveApi } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components'
import { StoreBrandLogo } from './StoreBrandLogo'

function storeNav(storeId: string | null) {
  return [
    { id: 'home', label: 'Home' },
    { id: 'categories', label: 'Categories' },
    { id: 'orders', label: 'Track Order', href: storeId ? storeOrdersPath(storeId) : '/orders' },
    { id: 'contact', label: 'Contact' },
  ] as const
}

type StorefrontHeaderProps = {
  storeName: string
  logoUrl?: string
  cartCount?: number
  cartHref?: string
  activeNav?: string
  searchOpen?: boolean
  onToggleSearch?: () => void
  onNavClick?: (id: string) => void
  onOpenMenu?: () => void
  /** When set, shows a compact back row for sub-pages (e.g. all products). */
  pageTitle?: string
  onBack?: () => void
  /** Shop actions including Sign in / account. Off only when a page hides the whole action cluster. */
  showActions?: boolean
  className?: string
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
      <Link to={href} className={className}>
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
        className="inline-flex h-9 shrink-0 items-center rounded-full bg-[var(--store-theme,var(--md-green-700))] px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
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
  storeName,
  logoUrl,
  trackOrderAlways = false,
}: {
  searchOpen: boolean
  onToggleSearch: () => void
  cartCount?: number
  cartHref?: string
  storeName?: string
  logoUrl?: string
  /** Compact headers have no desktop nav, so Track Order stays visible at every width. */
  trackOrderAlways?: boolean
}) {
  const user = useAuthStore((s) => s.user)
  const badge = visibleCartCount(user, cartCount)
  const shop = { name: storeName, logoUrl }
  const shopId = storeIdFromPath(cartHref)
  const ordersHref = shopId ? storeOrdersPath(shopId) : '/orders'
  const login = customerLoginLink(shopId ? storePath(shopId) : '/', shop)
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
          'inline-flex size-10 items-center justify-center rounded-full text-slate-700 transition',
          searchOpen ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-100',
        )}
        aria-label={searchOpen ? 'Close search' : 'Search products'}
        aria-pressed={searchOpen}
      >
        <Search className="size-[1.125rem]" strokeWidth={1.75} />
      </button>

      <Link
        to={ordersHref}
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100',
          !trackOrderAlways && 'lg:hidden',
        )}
        aria-label="Track order"
        title="Track order"
      >
        <ClipboardList className="size-[1.125rem]" strokeWidth={1.75} />
      </Link>

      <AccountControl loginTo={login.to} loginState={login.state} ordersHref={ordersHref} />

      <Link
        to={cartLink.to}
        state={cartLink.state}
        className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-visible rounded-full text-slate-700 transition hover:bg-slate-100"
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

/** Premium storefront header — brand logo, nav, search, account, cart. */
export function StorefrontHeader({
  storeName,
  logoUrl,
  cartCount = 0,
  cartHref,
  activeNav = 'home',
  searchOpen = false,
  onToggleSearch = () => undefined,
  onNavClick,
  onOpenMenu,
  pageTitle,
  onBack,
  showActions = true,
  className,
}: StorefrontHeaderProps) {
  const browsing = Boolean(onBack)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      {browsing ? (
        <div className="store-shell-inner flex h-12 items-center gap-2 sm:h-[3.25rem] sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-[var(--store-theme,var(--md-green-700))]"
            aria-label="Go back"
          >
            <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
          </button>

          {pageTitle ? (
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 sm:text-[15px]">
              {pageTitle}
            </p>
          ) : null}

          {showActions ? (
            <HeaderActions
              searchOpen={searchOpen}
              onToggleSearch={onToggleSearch}
              cartCount={cartCount}
              cartHref={cartHref}
              storeName={storeName}
              logoUrl={logoUrl}
              trackOrderAlways
            />
          ) : null}
        </div>
      ) : (
      <div className="store-shell-inner overflow-visible">
        <div className="flex h-16 min-w-0 items-center gap-2 sm:gap-3 lg:h-[4.5rem] lg:gap-6">
          {/* Mobile menu */}
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
            onClick={onOpenMenu}
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>

          {/* Brand — may shrink so search / account / track stay on screen */}
          <a
            href="#top"
            className="flex min-w-0 flex-1 items-center overflow-hidden lg:min-w-[220px] lg:flex-none"
            onClick={() => onNavClick?.('home')}
          >
            <StoreBrandLogo
              storeName={storeName}
              logoUrl={logoUrl}
              variant="full"
              className="[&_p:first-child]:text-sm [&_p:first-child]:sm:text-base"
            />
          </a>

          {/* Desktop nav — centered */}
          <nav
            className="hidden flex-1 items-center justify-center lg:flex"
            aria-label="Store navigation"
          >
            <div className="flex items-center gap-0.5">
              {storeNav(storeIdFromPath(cartHref)).map((item) => (
                <NavItem
                  key={item.id}
                  active={activeNav === item.id}
                  label={item.label}
                  href={'href' in item ? item.href : undefined}
                  onClick={'href' in item ? undefined : () => onNavClick?.(item.id)}
                />
              ))}
            </div>
          </nav>

          {/* Actions */}
          <HeaderActions
            searchOpen={searchOpen}
            onToggleSearch={onToggleSearch}
            cartCount={cartCount}
            cartHref={cartHref}
            storeName={storeName}
            logoUrl={logoUrl}
          />
        </div>
      </div>
      )}
    </header>
  )
}
