import { useState } from 'react'
import { MapPin } from 'lucide-react'
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

/** Dark hero — badges + title left; tagline right. Trust strip lives below in ServiceInfoBar. */
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
        'store-offer-banner store-offer-banner--dark relative isolate min-h-[220px] overflow-hidden rounded-2xl ring-1 ring-black/10 sm:min-h-[250px] lg:min-h-[280px]',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-slate-900 transition-opacity duration-500',
          imgLoaded ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden
      />

      <img
        src={image}
        alt=""
        onLoad={() => setImgLoaded(true)}
        className={cn(
          'absolute inset-0 size-full object-cover object-[center_right] brightness-[0.82] transition-opacity duration-500 sm:object-[70%_center]',
          imgLoaded ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, rgba(8,10,12,0.94) 0%, rgba(8,10,12,0.78) 42%, rgba(8,10,12,0.35) 68%, rgba(8,10,12,0.18) 100%)',
        }}
        aria-hidden
      />

      <div className="relative grid min-h-[inherit] gap-6 px-5 py-7 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-8 lg:px-8 lg:py-9">
        <div className="flex flex-col justify-center">
          {badges && badges.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {badges.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-[var(--store-accent-muted,rgba(249,115,22,0.45))] bg-[var(--store-accent-soft,rgba(249,115,22,0.22))] px-3 py-1 text-[11px] font-medium text-white"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : null}

          <h1 className="font-display mt-3.5 text-[1.45rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-[1.85rem] lg:text-[2rem]">
            {title}
          </h1>

          {location ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm text-white/80">
              <MapPin className="size-3.5 shrink-0 text-white/70" strokeWidth={2} aria-hidden />
              <span>{location}</span>
            </p>
          ) : null}

          <div className="mt-5">
            <button
              type="button"
              onClick={onShopNow}
              className="inline-flex h-10 items-center rounded-full border border-white/50 bg-black/25 px-7 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/70 hover:bg-black/35 active:scale-[0.98] sm:h-11"
            >
              Shop Now
            </button>
          </div>
        </div>

        {tagline ? (
          <div className="flex flex-col items-start justify-center lg:items-end lg:text-right">
            <p className="max-w-sm font-display text-base italic leading-snug text-white/95 sm:text-lg">
              {tagline}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
