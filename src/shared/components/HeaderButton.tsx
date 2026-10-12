import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from './ui'

/**
 * The one primary and one secondary treatment for header-bar actions (marketing, general,
 * storefront and vendor console): a pill link, with a chevron on primary.
 */
export function HeaderButton({
  to,
  state,
  emphasis,
  newTab,
  fullWidth,
  onClick,
  children,
}: {
  to: string
  state?: unknown
  emphasis: 'primary' | 'secondary'
  newTab?: boolean
  fullWidth?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  const primary = emphasis === 'primary'
  return (
    <Button
      asChild
      variant={primary ? 'primary' : 'outline'}
      fullWidth={fullWidth}
      className={cn(
        'h-10 rounded-full px-5 font-medium',
        // The default outline border is #e2e8f0, which vanishes on the white header.
        !primary && 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50',
      )}
    >
      <Link
        to={to}
        state={state}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={onClick}
      >
        {children}
        {primary ? <ChevronRight className="size-4 opacity-80" /> : null}
      </Link>
    </Button>
  )
}
