import { Link } from 'react-router-dom'
import { Button } from '@/shared/components'

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

const products = [
  { name: 'Farm Fresh Milk', price: 'From ₹48', bg: 'bg-sky-100', emoji: '🥛' },
  { name: 'Leafy Greens', price: 'From ₹30', bg: 'bg-emerald-100', emoji: '🥬' },
  { name: 'Organic Carrot', price: 'From ₹55', bg: 'bg-orange-100', emoji: '🥕' },
  { name: 'Country Eggs', price: 'From ₹90', bg: 'bg-amber-100', emoji: '🥚' },
]

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[240px] rounded-[2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl sm:w-[260px]">
      <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-slate-900" />
      <div className="overflow-hidden rounded-[1.35rem] bg-white">
        <div className="flex items-center justify-between px-3 py-2.5 text-[10px] font-semibold text-slate-700">
          <span aria-hidden>☰</span>
          <span className="text-emerald-600">MithraDirect</span>
          <span aria-hidden>🛒</span>
        </div>
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-3 py-4 text-white">
          <h3 className="font-display text-sm font-bold leading-tight">Straight From The Farm</h3>
          <p className="mt-1 text-[10px] text-emerald-50">Fresh · Local · Daily delivery</p>
        </div>
        <div className="grid grid-cols-4 gap-1 px-2 py-3 text-center text-[9px] text-slate-600">
          {[
            ['🥛', 'Milk'],
            ['🥬', 'Veggies'],
            ['🍎', 'Fruits'],
            ['🥚', 'Eggs'],
          ].map(([emoji, label]) => (
            <div key={label}>
              <div className="mx-auto mb-1 flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm">
                {emoji}
              </div>
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 px-2 pb-3">
          {products.map((p) => (
            <div
              key={p.name}
              className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm"
            >
              <div className={`flex h-14 items-center justify-center text-2xl ${p.bg}`}>{p.emoji}</div>
              <div className="space-y-0.5 p-1.5">
                <p className="truncate text-[10px] font-semibold text-slate-800">{p.name}</p>
                <p className="text-[9px] text-slate-500">{p.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden" id="top">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 85% 10%, rgba(16,185,129,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 0%, rgba(209,250,229,0.55), transparent), #ffffff',
        }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:py-20">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-slate-900 md:text-5xl lg:text-[3.25rem]">
            Launch your{' '}
            <span className="text-emerald-600">instagram page into online store in 5 minutes.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
            Create your storefront, sell through Instagram &amp; WhatsApp, and manage orders — with
            no coding required. Built for India’s neighbourhood businesses.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/vendor/login">
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

        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/40 blur-3xl" />

          <div className="absolute -right-1 top-4 z-20 w-[150px] rounded-xl border border-slate-100 bg-white p-3 shadow-lg sm:-right-4 sm:w-[168px]">
            <p className="text-xs font-bold text-slate-800">Share Your Store</p>
            <div className="mt-2 space-y-1.5 text-[11px] font-medium text-emerald-700">
              <a href="#" className="block rounded-md bg-emerald-50 px-2 py-1.5 hover:bg-emerald-100">
                WhatsApp
              </a>
              <a
                href="https://www.instagram.com/mithradirect/"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md bg-emerald-50 px-2 py-1.5 hover:bg-emerald-100"
              >
                Instagram
              </a>
              <button
                type="button"
                className="block w-full rounded-md bg-slate-50 px-2 py-1.5 text-left text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${window.location.origin}/stores`)
                }}
              >
                Copy store link
              </button>
            </div>
          </div>

          <PhoneMockup />

          <div className="absolute -left-2 bottom-8 z-20 w-[150px] rounded-xl border border-slate-100 bg-white p-3 shadow-lg sm:-left-6 sm:w-[168px]">
            <p className="text-xs font-bold text-slate-800">Orders on WhatsApp</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-emerald-600">152</p>
            <p className="text-[11px] text-slate-500">This Month</p>
            <svg className="mt-2 h-8 w-full" viewBox="0 0 160 42" fill="none" aria-hidden>
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
        </div>
      </div>
    </section>
  )
}
