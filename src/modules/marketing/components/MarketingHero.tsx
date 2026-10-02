import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components'
import { publicSiteOrigin } from '@/shared/lib/store-link'
import { createHeroOrderFeed, type HeroOrderFeed } from '@/modules/marketing/lib/hero-order-feed'
import { HeroCartBadge, HeroOrderToasts } from './HeroOrderToasts'

const trustItems = [
  {
    label: 'No Coding Required',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    label: 'Setup in 5 Minutes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    label: 'Zero Commission',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
]

type ProductKey = 'milk' | 'greens' | 'carrot' | 'eggs'

const products: { key: ProductKey; name: string; price: string; tile: string }[] = [
  { key: 'milk', name: 'Farm Fresh Milk', price: '₹48', tile: 'from-sky-100 to-sky-50' },
  { key: 'greens', name: 'Leafy Greens', price: '₹30', tile: 'from-emerald-100 to-emerald-50' },
  { key: 'carrot', name: 'Organic Carrot', price: '₹55', tile: 'from-orange-100 to-orange-50' },
  { key: 'eggs', name: 'Country Eggs', price: '₹90', tile: 'from-amber-100 to-amber-50' },
]

const categories = ['All', 'Milk', 'Veggies', 'Fruits', 'Eggs']

/* Flat two-tone drawings instead of emoji: they look the same on every platform and the
   preview stays on the brand palette. */
function ProductArt({ name }: { name: ProductKey }) {
  const common = { viewBox: '0 0 48 48', className: 'size-10 drop-shadow-sm', 'aria-hidden': true }
  switch (name) {
    case 'milk':
      return (
        <svg {...common}>
          <rect x="19" y="5" width="10" height="7" rx="2" fill="#0ea5e9" />
          <path d="M18 12h12l3 7v19a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V19z" fill="#fff" />
          <path d="M15 25h18v13a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4z" fill="#bae6fd" />
          <circle cx="24" cy="33" r="3.2" fill="#0ea5e9" opacity="0.85" />
        </svg>
      )
    case 'greens':
      return (
        <svg {...common}>
          <path d="M24 42C9 38 6 21 11 9c15 2 27 13 13 33z" fill="#10b981" />
          <path d="M26 42c-2-14 4-26 17-31 3 14-3 27-17 31z" fill="#34d399" />
          <path d="M24 42C22 31 18 21 11 9M26 42c3-11 8-20 17-31" stroke="#047857" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      )
    case 'carrot':
      return (
        <svg {...common}>
          <path d="M20 12c-1-5 2-8 4-9 2 1 5 4 4 9z" fill="#22c55e" />
          <path d="M14 18c0-4 4-6 10-6s10 2 10 6c0 8-6 20-10 26-4-6-10-18-10-26z" fill="#fb923c" transform="rotate(14 24 28)" />
          <path d="M20 22l4 1M22 29l5 1M23 36l3 1" stroke="#ea580c" strokeWidth="1.6" strokeLinecap="round" transform="rotate(14 24 28)" />
        </svg>
      )
    case 'eggs':
      return (
        <svg {...common}>
          <ellipse cx="17" cy="29" rx="9.5" ry="12" fill="#fde68a" />
          <ellipse cx="31" cy="29" rx="9.5" ry="12" fill="#fff7ed" />
          <ellipse cx="14" cy="24" rx="2.4" ry="4" fill="#fff" opacity="0.7" />
          <ellipse cx="28" cy="24" rx="2.4" ry="4" fill="#fff" opacity="0.9" />
        </svg>
      )
  }
}

function ShareIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      {children}
    </svg>
  )
}

const shareButton =
  'inline-flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'

/* The storefront a vendor ends up with, shown the way a customer holds it. The screen is
   deliberately taller than its content so the product grid reads as scrolled, not boxed in. */
function PhoneMockup({ feed }: { feed: HeroOrderFeed }) {
  return (
    <div className="relative w-[248px] rounded-[2.75rem] bg-gradient-to-b from-slate-700 via-slate-900 to-slate-950 p-[7px] shadow-[0_50px_90px_-35px_rgba(6,78,59,0.55),0_24px_40px_-24px_rgba(15,23,42,0.5)] ring-1 ring-slate-950/50 lg:w-[264px]">
      <span className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l bg-slate-700" aria-hidden />
      <span className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l bg-slate-700" aria-hidden />
      <span className="absolute -right-[2px] top-32 h-16 w-[3px] rounded-r bg-slate-700" aria-hidden />

      <div className="relative aspect-[9/18.5] overflow-hidden rounded-[2.2rem] bg-[#fbfdfc]">
        <span
          className="absolute left-1/2 top-2 z-20 h-[18px] w-[68px] -translate-x-1/2 rounded-full bg-slate-950"
          aria-hidden
        />
        <div
          className="flex items-center justify-between px-6 pt-2.5 text-[9px] font-semibold text-slate-800"
          aria-hidden
        >
          <span>9:41</span>
          <span className="flex items-end gap-[2px]">
            {[3, 5, 7, 9].map((h) => (
              <span key={h} className="w-[2px] rounded-sm bg-slate-800" style={{ height: h }} />
            ))}
          </span>
        </div>

        <div className="px-3 pt-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-display text-xs font-semibold text-white">
              L
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[11px] font-semibold leading-tight text-slate-900">
                Lakshmi Fresh Mart
              </p>
              <p className="flex items-center gap-1 text-[9px] text-slate-500">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Open now, 40 min delivery
              </p>
            </div>
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-900/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
                <path d="M6 7h12l-1 12H7zM9 7a3 3 0 0 1 6 0" />
              </svg>
              <HeroCartBadge feed={feed} />
            </span>
          </div>

          <div className="mt-2.5 flex h-7 items-center gap-1.5 rounded-full bg-slate-100/90 px-2.5 text-[9px] text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="size-3" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            Search milk, vegetables…
          </div>

          <div className="relative mt-2.5 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-700 to-emerald-900 p-3 text-white">
            <span className="absolute -right-6 -top-8 size-28 rounded-full border border-white/15" aria-hidden />
            <span className="absolute -right-2 -top-4 size-20 rounded-full border border-white/15" aria-hidden />
            <svg viewBox="0 0 48 48" className="absolute -bottom-2 right-0 size-[4.5rem] rotate-[8deg] opacity-95" aria-hidden>
              <path d="M24 44C8 39 5 20 11 6c17 2 30 15 13 38z" fill="#34d399" />
              <path d="M26 44c-3-15 4-28 19-34 3 16-3 30-19 34z" fill="#a7f3d0" />
              <path d="M24 44C22 31 17 19 11 6M26 44c3-12 9-23 19-34" stroke="#047857" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </svg>
            <p className="relative max-w-[6.5rem] font-display text-[13px] font-semibold leading-tight">
              Straight from the farm
            </p>
            <p className="relative mt-1 text-[9px] leading-snug text-emerald-100">
              Fresh · Local · Daily
            </p>
            <span className="relative mt-2.5 inline-block rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-emerald-800">
              Shop now
            </span>
          </div>

          <div className="mt-3 flex gap-1.5 overflow-hidden" aria-hidden>
            {categories.map((label, i) => (
              <span
                key={label}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-medium ${
                  i === 0 ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-900/10'
                }`}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {products.map((p) => (
              <div key={p.name} className="rounded-2xl bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
                <div className={`relative flex h-[60px] items-center justify-center rounded-xl bg-gradient-to-b ${p.tile}`}>
                  <ProductArt name={p.key} />
                  <span className="absolute bottom-1 right-1 flex size-[18px] items-center justify-center rounded-full bg-white text-xs font-semibold leading-none text-emerald-700 shadow-sm">
                    +
                  </span>
                </div>
                <div className="px-1 pb-1 pt-1.5">
                  <p className="truncate text-[10px] font-semibold text-slate-800">{p.name}</p>
                  <p className="text-[9px] text-slate-400">
                    From <span className="font-semibold text-slate-700">{p.price}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbfdfc] via-[#fbfdfc]/80 to-transparent" />
        <span className="absolute bottom-1.5 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-slate-900/80" aria-hidden />
      </div>
    </div>
  )
}

/* A shop doorway behind the phone, echoed once, over a faint dot grid that fades out. It sits
   inside the phone's own box so it scales with the phone. */
function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute -inset-x-28 -bottom-6 -top-4 -z-10 xl:inset-x-0" aria-hidden>
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(5,150,105,0.22) 1px, transparent 1.4px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)',
        }}
      />
      <div className="absolute bottom-0 left-1/2 h-[96%] w-[352px] -translate-x-1/2 rounded-t-full border border-b-0 border-emerald-200/60 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]" />
      <div className="absolute bottom-0 left-1/2 h-[88%] w-[312px] -translate-x-1/2 rounded-t-full border border-b-0 border-emerald-200/50 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)] bg-gradient-to-b from-emerald-100/90 via-emerald-50/70 to-transparent" />
    </div>
  )
}

export function MarketingHero() {
  const [linkCopied, setLinkCopied] = useState(false)
  // Created once and never set: a feed tick re-renders only its subscribers, not the hero.
  const [feed] = useState(createHeroOrderFeed)

  return (
    <section
      className="relative isolate -mt-[5.0625rem] overflow-hidden pt-[5.0625rem] xl:-mt-[5.5625rem] xl:pt-[5.5625rem]"
      id="top"
    >
      {/* The section reaches up under the sticky header (its height is the negative margin,
          given back as padding) so the glow carries behind the transparent header. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        style={{ background: 'linear-gradient(#fcfefd, #f5fbf8)' }}
        aria-hidden
      >
        <div
          className="md-hero-glow md-hero-glow-a"
          style={{
            background:
              'radial-gradient(ellipse 75% 100% at -5% 78%, rgba(150,228,196,0.8) 0%, rgba(196,242,222,0.5) 42%, transparent 78%)',
          }}
        />
        <div
          className="md-hero-glow md-hero-glow-b"
          style={{
            background:
              'radial-gradient(ellipse 70% 100% at 105% 85%, rgba(252,224,182,0.95) 0%, rgba(254,240,215,0.55) 42%, transparent 80%)',
          }}
        />
        {/* Dotted white grid lines, brightest low and at the sides, gone behind the headline. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, #fff 1.1px, transparent 1.6px), radial-gradient(circle, #fff 1.1px, transparent 1.6px)',
            backgroundSize: '7px 72px, 72px 7px',
            maskImage: 'radial-gradient(ellipse 100% 100% at 50% 85%, #000 20%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 85%, #000 20%, transparent 80%)',
          }}
        />
      </div>

      <div className="marketing-measure marketing-gutter box-content grid items-center gap-12 py-12 [--hero-py:clamp(2rem,6svh,4.5rem)] xl:[--hero-py:clamp(1.5rem,4svh,3.5rem)] md:min-h-[calc(100svh_-_5.0625rem_-_2*var(--hero-py))] md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:py-(--hero-py) xl:min-h-[calc(100svh_-_5.5625rem_-_2*var(--hero-py))]">
        <div>
          <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-[-0.02em] text-slate-900 md:text-[2.6rem] lg:text-5xl xl:text-[3.25rem] [@media(min-width:84rem)_and_(min-height:800px)]:text-[3.625rem] [@media(min-width:84rem)_and_(min-height:910px)]:text-[4rem]">
            Launch your{' '}
            <span className="text-emerald-600">instagram page into online store in 5 minutes.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg [@media(min-width:84rem)_and_(min-height:910px)]:text-xl">
            Create your storefront, sell through Instagram &amp; WhatsApp, and manage orders — with
            no coding required. Built for India’s neighbourhood businesses.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/onboarding">
              <Button size="lg" className="rounded-full px-6">
                Start Your Store Free
              </Button>
            </Link>
            <Link
              to="/stores"
              className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-emerald-600 bg-white px-5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
              View Demo Store
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {trustItems.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
              >
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  {item.icon}
                </span>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative isolate mx-auto flex w-full max-w-md justify-center pb-6 md:max-w-none xl:justify-end">
          <div className="md-hero-rise md-hero-scale relative xl:px-[7.5rem]">
            <HeroBackdrop />
            <div className="relative">
              <PhoneMockup feed={feed} />
              <HeroOrderToasts feed={feed} />

              <div className="absolute -left-8 top-[67%] z-20 w-[148px] rounded-2xl bg-white/90 p-3 max-sm:-left-9 max-[23rem]:-left-6 max-sm:top-[75%] max-sm:w-[136px] max-sm:p-2 shadow-[0_18px_40px_-16px_rgba(6,78,59,0.45)] ring-1 ring-slate-900/5 backdrop-blur sm:-left-14 lg:-left-24 xl:-left-[7.5rem]">
                <p className="text-[11px] font-semibold text-slate-800">Orders on WhatsApp</p>
                <p className="mt-1 font-display text-3xl font-semibold leading-none text-emerald-600 max-sm:text-2xl">152</p>
                <p className="mt-1 text-[11px] text-slate-500">This Month</p>
                <svg className="mt-2 h-8 w-full max-sm:hidden" viewBox="0 0 160 42" fill="none" aria-hidden>
                  <path
                    d="M2 34 C20 30, 28 18, 45 20 C62 22, 70 8, 90 12 C110 16, 120 6, 138 10 C148 12, 154 8, 158 6"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M2 34 C20 30, 28 18, 45 20 C62 22, 70 8, 90 12 C110 16, 120 6, 138 10 C148 12, 154 8, 158 6 V42 H2 Z"
                    fill="url(#sparkGrad)"
                    opacity="0.25"
                  />
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="absolute -bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/90 py-1.5 pl-4 pr-1.5 shadow-[0_18px_40px_-16px_rgba(6,78,59,0.45)] ring-1 ring-slate-900/5 backdrop-blur">
                <span className="text-[11px] font-semibold text-slate-700">Share your store</span>
                <a href="#" aria-label="Share on WhatsApp" title="WhatsApp" className={shareButton}>
                  <ShareIcon>
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                  </ShareIcon>
                </a>
                <a
                  href="https://www.instagram.com/mithradirect/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Instagram"
                  title="Instagram"
                  className={shareButton}
                >
                  <ShareIcon>
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <path d="M17.5 6.5h.01" />
                  </ShareIcon>
                </a>
                <button
                  type="button"
                  aria-label={linkCopied ? 'Store link copied' : 'Copy store link'}
                  title={linkCopied ? 'Copied' : 'Copy store link'}
                  className={shareButton}
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${publicSiteOrigin()}/stores`)
                    setLinkCopied(true)
                    window.setTimeout(() => setLinkCopied(false), 1600)
                  }}
                >
                  <ShareIcon>
                    {linkCopied ? (
                      <path d="M5 13l4 4L19 7" />
                    ) : (
                      <>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </>
                    )}
                  </ShareIcon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
