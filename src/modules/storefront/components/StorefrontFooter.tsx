import { cn } from '@/lib/utils'

function Dot() {
  return <span className="text-slate-300" aria-hidden>·</span>
}

type StorefrontFooterProps = {
  storeName: string
  logoUrl?: string
  tagline?: string
  phone?: string
  email?: string
  location?: string
  id?: string
  className?: string
}

export function StorefrontFooter({
  storeName,
  logoUrl,
  tagline,
  phone,
  location,
  id,
  className,
}: StorefrontFooterProps) {
  const initial = storeName.trim().slice(0, 1).toUpperCase() || 'A'
  const year = new Date().getFullYear()
  const digits = phone?.replace(/\D/g, '') ?? ''
  const tel = digits ? `+${digits}` : phone?.replace(/\s/g, '')

  return (
    <footer id={id} className={cn('mt-5 border-t border-slate-200/90 bg-[#f6f8f7]', className)}>
      <div className="store-shell-inner py-4 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-7 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--store-theme,var(--md-green-600))] text-[10px] font-bold text-white">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{storeName}</p>
              <p className="truncate text-[11px] text-slate-500">{tagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 sm:text-xs">
            {phone ? (
              <>
                <a
                  href={`tel:${tel}`}
                  className="transition hover:text-[var(--store-theme,var(--md-green-700))]"
                >
                  {phone}
                </a>
                {location ? <Dot /> : null}
              </>
            ) : null}
            {location ? <span className="text-slate-500">{location}</span> : null}
          </div>
        </div>

        <p className="mt-3 border-t border-slate-200/80 pt-2.5 text-[10px] text-slate-400 sm:text-[11px]">
          © {year} {storeName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
