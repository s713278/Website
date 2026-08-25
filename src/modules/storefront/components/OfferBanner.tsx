import { useState } from 'react'
import { cn } from '@/lib/utils'

const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1600&h=900&q=90'

type OfferBannerProps = {
  badge?: string
  title: string
  subtitle: string
  heroImage?: string
  onShopNow?: () => void
  className?: string
}

/** Dark hero — text on left, photo visible on the right; glass CTA. */
export function OfferBanner({
  badge = '100% Homemade',
  title,
  subtitle,
  heroImage = DEFAULT_HERO,
  onShopNow,
  className,
}: OfferBannerProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const image = heroImage || DEFAULT_HERO

  return (
    <section
      id="top"
      className={cn(
        'store-offer-banner store-offer-banner--dark relative isolate min-h-[230px] overflow-hidden rounded-2xl ring-1 ring-black/10 sm:min-h-[260px] lg:min-h-[300px]',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-[#022c22] transition-opacity duration-500',
          imgLoaded ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden
      />

      <img
        src={image}
        alt=""
        onLoad={() => setImgLoaded(true)}
        className={cn(
          'absolute inset-0 size-full object-cover object-[center_right] brightness-[0.88] transition-opacity duration-500 sm:object-[70%_center]',
          imgLoaded ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(2, 20, 15, 0.93) 0%, rgba(2, 20, 15, 0.72) 38%, rgba(2, 20, 15, 0.22) 58%, transparent 72%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10"
        aria-hidden
      />

      <div className="relative grid min-h-[inherit] lg:grid-cols-[minmax(0,54%)_1fr]">
        <div className="flex flex-col justify-center px-5 py-7 sm:px-7 sm:py-9 lg:pl-8">
          <span className="inline-flex w-fit rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100 backdrop-blur-sm sm:text-[11px]">
            {badge}
          </span>

          <h1 className="font-display mt-3.5 text-[1.45rem] font-extrabold leading-[1.12] tracking-tight text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.5)] sm:text-[1.9rem] lg:text-[2rem]">
            {title}
          </h1>

          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-200/90 sm:text-[15px]">
            {subtitle}
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={onShopNow}
              className="inline-flex h-10 items-center rounded-full border border-white/45 bg-white/10 px-7 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition hover:border-white/70 hover:bg-white/20 active:scale-[0.98] sm:h-11"
            >
              Shop Now
            </button>
          </div>
        </div>

        <div className="hidden min-h-[120px] lg:block" aria-hidden />
      </div>
    </section>
  )
}
