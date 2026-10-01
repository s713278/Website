import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react'
import logoDarkMd from '@/assets/logo_dark_md.png'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/utils'
import { useHeaderActions } from '../hooks/useHeaderActions'
import type { HeaderAction } from '../lib/header-actions'

// Only a vendor with unfinished setup can open it, so it stays out of the first bundle.
const ConfirmDialog = lazy(() =>
  import('@/modules/vendor/components/onboarding/ConfirmDialog').then((m) => ({
    default: m.ConfirmDialog,
  })),
)

const NAV = [
  { label: 'About Us', href: '#about' },
  { label: 'Search Stores', to: '/stores' },
  { label: 'Store Demo', to: '/stores' },
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
  const button = (
    <Button
      variant={primary ? 'primary' : 'outline'}
      fullWidth={mobile}
      className={cn(
        'h-10 rounded-[10px] px-5 font-medium',
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
  return (
    <Link to={action.to} onClick={onNavigate}>
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
  const [confirmingLogOut, setConfirmingLogOut] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100/70 bg-white/95 backdrop-blur">
      {/* Same gutter and 7xl measure as the landing sections' `SectionShell` (padding outside the
          max-width box), so the logo and the last action sit on the same edges as the content. */}
      <div className="px-4 sm:px-6">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-6">
          {/* Logo and links read as one group; the actions stand apart on the right. */}
          <div className="flex items-center gap-10">
            <BrandMark />

            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 lg:flex">
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

          <div className="hidden items-center gap-3 lg:flex">
            {actions.map((action) => (
              <HeaderActionButton
                key={action.label}
                action={action}
                onLogOut={() => setConfirmingLogOut(true)}
              />
            ))}
          </div>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div className={cn('border-t border-slate-100 bg-white px-4 py-4 sm:px-6 lg:hidden', !open && 'hidden')}>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm font-medium text-slate-700">
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
              onLogOut={() => setConfirmingLogOut(true)}
            />
          ))}
        </div>
      </div>
      {confirmingLogOut ? (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="Log out?"
            description="This signs you out on this device. Anything already saved to your store stays on your account, and is picked up when you sign in again with this number. Unsaved details in this browser are cleared."
            confirmLabel="Log out"
            tone="danger"
            onConfirm={() => void logout()}
            onOpenChange={setConfirmingLogOut}
          />
        </Suspense>
      ) : null}
    </header>
  )
}
