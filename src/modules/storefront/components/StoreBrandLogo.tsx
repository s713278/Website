import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

type StoreBrandLogoProps = {
  storeName: string
  logoUrl?: string
  /** compact = icon + one line; full = icon + wordmark */
  variant?: 'compact' | 'full'
  className?: string
}

/** Vendor storefront logo — mark + wordmark (no platform branding). */
export function StoreBrandLogo({
  storeName,
  logoUrl,
  variant = 'full',
  className,
}: StoreBrandLogoProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="size-9 shrink-0 rounded-lg object-contain p-0.5 ring-1 ring-slate-200/80 sm:size-10 sm:rounded-[10px]"
        />
      ) : (
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--store-theme,var(--md-green-600))] text-white sm:size-10 sm:rounded-[10px]"
          aria-hidden
        >
          <Leaf className="size-5 fill-current" strokeWidth={1.5} />
        </span>
      )}

      <div className={cn('min-w-0 leading-tight', variant === 'compact' && 'hidden sm:block')}>
        <p className="truncate font-display text-[15px] font-bold tracking-tight text-slate-900 sm:text-base">
          {storeName}
        </p>
      </div>
    </div>
  )
}
