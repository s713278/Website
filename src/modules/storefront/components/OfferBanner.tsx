import { useState } from 'react'
import { ArrowRight, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1600&h=900&q=90'

type OfferBannerProps = {
  title: string
  /** Right-side italic line — usually store tagline. */
  tagline?: string
  /** Optional location under the title (e.g. city). */
  location?: string
  heroImage?: string
  badges?: string[]
  onShopNow?: () => void
  className?: string
}

/** Store hero — 16:9 banner image with content top, CTA bottom. */
export function OfferBanner({
  badges,
  title,
  tagline,
  location,
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
        'store-offer-banner store-offer-banner--dark relative isolate overflow-hidden rounded-2xl',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-slate-800 transition-opacity duration-500',
          imgLoaded ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden
      />

      <img
        src={image}
        alt=""
        width={1600}
        height={900}
        onLoad={() => setImgLoaded(true)}
        className={cn(
          'store-offer-banner__image absolute inset-0 size-full object-cover object-center transition-opacity duration-500',
          imgLoaded ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div className="store-offer-banner__scrim pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
        <div className="min-w-0 max-w-xl">
          {badges && badges.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 sm:gap-2">
              {badges.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-white/25 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md sm:px-3 sm:text-[11px]"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : null}

          <h1 className="font-display mt-2.5 text-[1.35rem] font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-sm sm:mt-3 sm:text-[1.85rem] lg:text-[2rem]">
            {title}
          </h1>

          {location ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-white/85 sm:mt-2 sm:text-sm">
              <MapPin className="size-3.5 shrink-0 text-white/75" strokeWidth={2} aria-hidden />
              <span className="truncate">{location}</span>
            </p>
          ) : null}

          {tagline ? (
            <p className="mt-2 line-clamp-2 font-display text-sm italic leading-snug text-white/90 sm:mt-2.5 sm:text-base">
              {tagline}
            </p>
          ) : null}
        </div>

        <div className="mt-4 shrink-0 sm:mt-5">
          <button
            type="button"
            onClick={onShopNow}
            className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/50 bg-white/20 px-5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.98] sm:h-11 sm:px-6"
          >
            Shop Now
            <ArrowRight
              className="size-4 transition group-hover:translate-x-0.5"
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </section>
  )
}
