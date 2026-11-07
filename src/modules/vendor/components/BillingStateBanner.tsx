import { Link } from 'react-router-dom'
import type { PrototypeBanner } from '@/modules/vendor/lib/billing-prototype-card'
import { cn } from '@/shared/lib/utils'

const toneClass: Record<PrototypeBanner['tone'], { banner: string; lead: string }> = {
  neutral: { banner: 'border-[var(--vc-tint-line)] bg-[image:var(--vc-banner)]', lead: '' },
  danger: { banner: 'border-destructive/30 bg-destructive/[0.04]', lead: 'text-destructive' },
  warning: { banner: 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30', lead: 'text-[var(--badge-warning-fg)]' },
}

/**
 * The shop-plan state in one line, with a link to Plan. Messaging only: it opens no Checkout, so
 * any vendor page can show it.
 */
export function BillingStateBanner({ banner, className }: { banner: PrototypeBanner; className?: string }) {
  const tone = toneClass[banner.tone]
  return (
    <div role="status" aria-label="Shop plan status"
      className={cn('flex flex-wrap items-center justify-between gap-2.5 rounded-[var(--vc-radius)] border px-4 py-3 text-sm text-slate-700 dark:text-slate-200', tone.banner, className)}>
      <p className="min-w-0 flex-1 basis-64"><strong className={cn('font-semibold', tone.lead)}>{banner.lead}</strong> — {banner.text}</p>
      <Link to="/vendor/plan"
        className="rounded-full border border-[var(--vc-tint-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--vc-tint-ink)] transition hover:bg-[var(--vc-tint)]">
        {banner.action}
      </Link>
    </div>
  )
}
