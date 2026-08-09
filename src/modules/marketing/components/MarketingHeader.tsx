import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

const NAV = [
  { label: 'About Us', href: '#about' },
  { label: 'Search Stores', to: '/stores' },
  { label: 'Store Demo', to: '/stores/r1' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
] as const

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-sm">
        M
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[1.05rem] font-bold tracking-tight text-slate-800">
          mithra <span className="font-semibold text-slate-700">direct</span>
        </span>
        <span className="hidden text-[10px] text-slate-500 sm:block">
          Shop Local, Support Local, Grow Together.
        </span>
      </span>
    </Link>
  )
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100/70 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-4">
        <BrandMark />

        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-700 lg:flex">
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

        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-emerald-700">
            Vendor Login
          </Link>
          <Link to="/register">
            <Button className="rounded-full px-5">Get Started Free</Button>
          </Link>
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

      <div className={cn('border-t border-slate-100 bg-white px-4 py-4 lg:hidden', !open && 'hidden')}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm font-medium text-slate-700">
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
          <Link to="/login" onClick={() => setOpen(false)}>
            Vendor Login
          </Link>
          <Link to="/register" onClick={() => setOpen(false)}>
            <Button fullWidth className="rounded-full">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
