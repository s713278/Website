import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

type StoreBrandLogoProps = {
  storeName: string
  logoUrl?: string
  /** compact = icon + one line; full = icon + two-line wordmark */
  variant?: 'compact' | 'full'
  className?: string
}

function splitStoreName(name: string): { primary: string; secondary: string } {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return { primary: name, secondary: '' }
  return { primary: parts[0], secondary: parts.slice(1).join(' ') }
}

/** Vendor storefront logo — leaf mark + wordmark (no platform branding). */
export function StoreBrandLogo({
  storeName,
  logoUrl,
  variant = 'full',
  className,
}: StoreBrandLogoProps) {
  const { primary, secondary } = splitStoreName(storeName)

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="size-10 shrink-0 rounded-[10px] object-contain p-0.5 ring-1 ring-emerald-100"
        />
      ) : (
        <span
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-50 to-emerald-100 ring-1 ring-emerald-200/80"
          aria-hidden
        >
          <Leaf className="size-5 fill-emerald-600 text-emerald-600" strokeWidth={1.5} />
        </span>
      )}

      <div className={cn('min-w-0 leading-tight', variant === 'compact' && 'hidden sm:block')}>
        <p className="truncate font-display text-[15px] font-bold tracking-tight text-slate-900 sm:text-base">
          {variant === 'compact' ? storeName : primary}
        </p>
        {variant === 'full' && secondary ? (
          <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs">{secondary}</p>
        ) : null}
      </div>
    </div>
  )
}
