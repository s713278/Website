import { HeaderButton } from '@/shared/components'
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
  return (
    <HeaderButton
      to={action.to}
      emphasis={action.emphasis === 'primary' ? 'primary' : 'secondary'}
      newTab={newTab}
      fullWidth={mobile}
      onClick={onNavigate}
    >
      {action.label}
    </HeaderButton>
  )
}
