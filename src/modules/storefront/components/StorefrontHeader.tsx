import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, Menu, Search, ShoppingCart, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loginPathForRole } from '@/app/router/role-home'
import { StoreBrandLogo } from './StoreBrandLogo'

const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'categories', label: 'Categories' },
  { id: 'orders', label: 'Track Order', href: '/orders' },
  { id: 'contact', label: 'Contact' },
] as const

type StorefrontHeaderProps = {
  storeName: string
  logoUrl?: string
  cartCount: number
  cartHref?: string
  activeNav?: string
  searchOpen: boolean
  onToggleSearch: () => void
  onNavClick?: (id: string) => void
  onOpenMenu?: () => void
  /** When set, shows a compact back row for sub-pages (e.g. all products). */
  pageTitle?: string
  onBack?: () => void
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

function HeaderActions({
  searchOpen,
  onToggleSearch,
  cartCount,
  cartHref = '/cart',
  showAccount = false,
}: {
  searchOpen: boolean
  onToggleSearch: () => void
  cartCount: number
  cartHref?: string
  showAccount?: boolean
}) {
  const location = useLocation()
  const loginHref = {
    pathname: loginPathForRole('customer'),
    state: { from: location.pathname + location.search },
  }

  return (
    <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
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

      {showAccount ? (
        <Link
          to={loginHref}
          className="hidden size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
          aria-label="Sign in"
        >
          <User className="size-[1.125rem]" strokeWidth={1.75} />
        </Link>
      ) : null}

      <Link
        to={cartHref}
        className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-visible rounded-full text-slate-700 transition hover:bg-slate-100"
        aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}
      >
        <ShoppingCart className="size-[1.125rem]" strokeWidth={1.75} />
        {cartCount > 0 ? (
          <span className="absolute right-1.5 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--store-theme,var(--md-green-600))] px-0.5 text-[9px] font-bold leading-none text-white">
            {cartCount > 9 ? '9+' : cartCount}
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
  cartCount,
  cartHref,
  activeNav = 'home',
  searchOpen,
  onToggleSearch,
  onNavClick,
  onOpenMenu,
  pageTitle,
  onBack,
  className,
}: StorefrontHeaderProps) {
  const browsing = Boolean(onBack)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 overflow-visible border-b border-slate-200/80 bg-white/90 backdrop-blur-xl',
        className,
      )}
    >
      {browsing ? (
        <div className="store-shell-inner flex h-12 items-center gap-3 sm:h-[3.25rem]">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center justify-center rounded-full p-1.5 text-slate-700 transition hover:bg-slate-100 hover:text-[var(--store-theme,var(--md-green-700))]"
            aria-label="Back to store home"
          >
            <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
          </button>

          {pageTitle ? (
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 sm:text-[15px]">
              {pageTitle}
            </p>
          ) : null}

          <HeaderActions
            searchOpen={searchOpen}
            onToggleSearch={onToggleSearch}
            cartCount={cartCount}
            cartHref={cartHref}
          />
        </div>
      ) : (
      <div className="store-shell-inner overflow-visible">
        <div className="flex h-16 items-center gap-3 lg:h-[4.5rem] lg:gap-6">
          {/* Mobile menu */}
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
            onClick={onOpenMenu}
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>

          {/* Brand */}
          <a
            href="#top"
            className="flex min-w-0 shrink-0 items-center lg:min-w-[220px]"
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
              {NAV.map((item) => (
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
            showAccount
          />
        </div>
      </div>
      )}
    </header>
  )
}
