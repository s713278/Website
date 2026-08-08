import { Link } from 'react-router-dom'
import { Button } from '@/shared/components'

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--md-green-100),_transparent_50%),linear-gradient(180deg,#ecfdf5_0%,transparent_55%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--md-green-700)]">
            MithraDirect
          </p>
          <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
            Local stores, delivered fast.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-600 md:text-lg">
            Discover nearby stores, build a cart, and checkout in minutes — or run your shop
            with the vendor console.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/stores"><Button size="lg">Order now</Button></Link>
            <Link to="/register"><Button size="lg" variant="secondary">Become a vendor</Button></Link>
          </div>
        </div>
        <div className="relative min-h-[280px] overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#047857_0%,#0f766e_40%,#115e59_100%)] p-6 text-white shadow-[var(--md-shadow)] md:min-h-[360px]">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute bottom-10 right-8 h-24 w-24 rounded-full bg-emerald-300/20" />
          <p className="relative text-sm font-semibold text-emerald-100">Tonight near you</p>
          <h2 className="font-display relative mt-2 text-3xl font-bold">Green Bowl Kitchen</h2>
          <p className="relative mt-2 max-w-xs text-sm text-emerald-50/90">
            Millet bowls · 28 mins · 4.6★ — popular with office parks and hostels.
          </p>
          <div className="relative mt-8 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
            40% OFF up to ₹80
          </div>
        </div>
      </div>
    </section>
  )
}
