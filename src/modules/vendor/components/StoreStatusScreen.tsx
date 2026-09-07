import { Link } from 'react-router-dom'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  presentStoreState,
  setupProgress,
  storeStateAction,
} from '@/modules/vendor/lib/store-state'
import type { StoreState } from '@/modules/vendor/types/dashboard'
import { Button, Card } from '@/shared/components'

/**
 * Overview for a store that is not open.
 *
 * One screen for all four states, parameterised by `presentStoreState` and
 * `storeStateAction`, rather than four hand-written pages. Four pages drift: the copy for
 * suspension acquires a "your store is live" line nobody notices, and the state that cannot
 * be reproduced on a test account is the one that rots.
 *
 * No figures appear here. A store that is still setting up, waiting, rejected or suspended
 * has no work queue to show, and putting counts on this screen would suggest otherwise.
 */
export function StoreStatusScreen({ state }: { state: Exclude<StoreState, 'OPEN'> }) {
  const { context } = useVendorAccount()
  const presentation = presentStoreState(state)
  const action = storeStateAction(state)
  const progress = setupProgress(context.onboarding.nextStep)

  return (
    <Card className="max-w-[68ch] p-5">
      <h2 className="font-display text-lg font-semibold">{presentation.label}</h2>
      <p className="mt-2 max-w-[68ch] text-sm text-[var(--md-muted)]">{presentation.description}</p>

      {action ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to={action.to}>
            <Button size="sm">{action.label}</Button>
          </Link>
          {/*
            Shown beside the setup action only. `next_step` is what the vendor resumes on,
            and it is the one number on this screen that comes from the backend rather than
            from a guess about how long approval takes.
          */}
          {state === 'SETTING_UP' && progress ? (
            <span className="vc-num text-sm text-[var(--md-muted)]">
              Step {progress.step} of {progress.total}
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
