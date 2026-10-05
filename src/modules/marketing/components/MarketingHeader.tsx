import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react'
import logoDarkMd from '@/assets/logo_dark_md.png'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/utils'
import { useHeaderActions } from '../hooks/useHeaderActions'
import { isOnboardingPath, type HeaderAction } from '../lib/header-actions'

const NAV = [
  { label: 'About Us', href: '#about' },
  { label: 'Search Stores', to: '/stores' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
] as const

function BrandMark() {
  return (
    <Link to="/" aria-label="Mithra Direct home">
      <img
        src={logoDarkMd}
        alt="Mithra Direct — Shop Local, Support Local, Grow Together"
        className="h-10 w-auto sm:h-11"
      />
    </Link>
  )
}

function HeaderActionButton({
  action,
  mobile,
  onNavigate,
  onLogOut,
}: {
  action: HeaderAction
  mobile?: boolean
  onNavigate?: () => void
  onLogOut: () => void
}) {
  const primary = action.emphasis === 'primary'
  const { pathname } = useLocation()
  const button = (
    <Button
      variant={primary ? 'primary' : 'outline'}
      fullWidth={mobile}
      className={cn(
        'h-10 rounded-full px-5 font-medium',
        // The default outline border is #e2e8f0, which vanishes on the white header.
        !primary && 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50',
      )}
      onClick={
        action.label === 'Log out'
          ? () => {
              onNavigate?.()
              onLogOut()
            }
          : undefined
      }
    >
      {action.label}
      {primary ? <ChevronRight className="size-4 opacity-80" /> : null}
    </Button>
  )
  if (action.label === 'Log out') return button
  // From the wizard, Dashboard is where the vendor goes next, so it replaces the page.
  const sameTab = action.label === 'Dashboard' && isOnboardingPath(pathname)
  return (
    <Link
      to={action.to}
      {...(sameTab ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      onClick={onNavigate}
    >
      {button}
    </Link>
  )
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  // The onboarding wizard mounts this header, so these follow the vendor's account rather
  // than showing a login link to someone part-way through store setup.
  const actions = useHeaderActions()
  const logout = useAuthStore((state) => state.logout)

  // On the landing page the hero runs underneath the header, so at the top of the page the
  // header lets its background through. Once the page scrolls (or the menu opens over it) it
  // goes back to the solid bar every other page uses.
  const onHome = useLocation().pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!onHome) return
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [onHome])
  const clear = onHome && !scrolled && !open

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
        clear ? 'border-transparent bg-transparent' : 'border-emerald-100/70 bg-white/95 backdrop-blur',
      )}
    >
      {/* Same gutter and measure as the landing sections (padding outside the max-width box), so
          the logo and the last action sit on the same edges as the content. The links and both
          actions need about 1050px, more than the 960px a 1024 viewport leaves, so the menu
          button takes over until `xl`. */}
      <div className="marketing-gutter">
        <div className="marketing-measure flex h-20 items-center justify-between gap-6 xl:h-[5.5rem]">
          {/* Logo and links read as one group; the actions stand apart on the right. */}
          <div className="flex items-center gap-10">
            <BrandMark />

            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 xl:flex">
              {NAV.map((item) =>
                'to' in item ? (
                  <Link key={item.label} to={item.to} className="hover:text-emerald-700">
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.label} href={item.href} className="hover:text-emerald-700">
                    {item.label}
                  </a>
                ),
              )}
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-emerald-700"
                  onClick={() => setResourcesOpen((v) => !v)}
                  aria-expanded={resourcesOpen}
                >
                  Resources <ChevronDown className="size-4 opacity-70" />
                </button>
                {resourcesOpen ? (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <a
                      href="#how-it-works"
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-emerald-50"
                      onClick={() => setResourcesOpen(false)}
                    >
                      How it works
                    </a>
                    <Link
                      to="/login"
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-emerald-50"
                      onClick={() => setResourcesOpen(false)}
                    >
                      Help & support
                    </Link>
                  </div>
                ) : null}
              </div>
            </nav>
          </div>

          <div className="hidden items-center gap-3 xl:flex">
            {actions.map((action) => (
              <HeaderActionButton
                key={action.label}
                action={action}
                onLogOut={() => void logout()}
              />
            ))}
          </div>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 xl:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div className={cn('marketing-gutter border-t border-slate-100 bg-white py-4 xl:hidden', !open && 'hidden')}>
        <div className="marketing-measure flex flex-col gap-3 text-sm font-medium text-slate-700">
          {NAV.map((item) =>
            'to' in item ? (
              <Link key={item.label} to={item.to} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ),
          )}
          {actions.map((action) => (
            <HeaderActionButton
              key={action.label}
              action={action}
              mobile
              onNavigate={() => setOpen(false)}
              onLogOut={() => void logout()}
            />
          ))}
        </div>
      </div>
    </header>
  )
}
