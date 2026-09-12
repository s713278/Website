import type { ReactNode } from 'react'
import { Card } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/**
 * The console's one panel shape: a title, one control opposite it, and the content below.
 *
 * From `design-reference/dashboard.html` — `.dash-panel` and `.dash-panel-head`. Every
 * surface builds out of this, so a vendor moving between them reads the same frame six
 * times rather than learning six.
 *
 * The heading is an `h2`. The console's only `h1` is the page title in the top bar, so a
 * panel that promoted itself would leave the document outline with two competing roots.
 *
 * The shell, edge and corner come from `.vendor-console [data-slot='card']` in
 * `global.css`; only the padding and the head live here.
 */
export function DashboardPanel({
  title,
  titleId,
  action,
  className,
  children,
}: {
  /** Omit for a panel whose content already names itself. */
  title?: ReactNode
  /** For `aria-labelledby` when a section outside the panel points at this heading. */
  titleId?: string
  /** The one control the panel offers: an edit link, a see-all, a note about the data. */
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('p-[clamp(0.9rem,2vw,1.15rem)]', className)}>
      {title ? (
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-base font-semibold">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </Card>
  )
}
