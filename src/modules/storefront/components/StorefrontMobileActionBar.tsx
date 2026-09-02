import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Sticky bottom CTA strip — mobile/tablet only; clears iOS home indicator. */
export function StorefrontMobileActionBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm',
        'pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Reserve space above a mobile sticky action bar. */
export const STOREFRONT_MOBILE_ACTION_PAD = 'pb-24 lg:pb-0'
