import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/utils'
import type { HeaderAction } from '../lib/header-actions'

/**
 * One header action as a pill button. The marketing header opens actions in a new tab so the
 * landing page stays put; app pages (`newTab` unset) navigate in place.
 */
export function HeaderActionButton({
  action,
  mobile,
  newTab,
  onNavigate,
}: {
  action: HeaderAction
  mobile?: boolean
  newTab?: boolean
  onNavigate?: () => void
}) {
  const primary = action.emphasis === 'primary'
  return (
    <Link
      to={action.to}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={onNavigate}
    >
      <Button
        variant={primary ? 'primary' : 'outline'}
        fullWidth={mobile}
        className={cn(
          'h-10 rounded-full px-5 font-medium',
          // The default outline border is #e2e8f0, which vanishes on the white header.
          !primary && 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50',
        )}
      >
        {action.label}
        {primary ? <ChevronRight className="size-4 opacity-80" /> : null}
      </Button>
    </Link>
  )
}
