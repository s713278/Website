import { BuildingIcon, CheckCircle2Icon, CircleAlertIcon, ClockIcon, DatabaseIcon, StoreIcon, UserXIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui'
import type { OnboardingAccess } from '../../lib/onboarding-access'

type AccessNoticeProps = {
  access: OnboardingAccess
  onSelectVendor: (vendorId: string) => void
  onSignOut: () => void
}

function Shell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[var(--ob-line)] bg-[var(--ob-canvas)] p-6">
      <div className="flex gap-3.5">
        <span className="mt-0.5 shrink-0 text-[var(--ob-ink-soft)]" aria-hidden="true">{icon}</span>
        <div className="space-y-2.5">
          <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--ob-ink)]">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Shown instead of Steps 3-10 when the session cannot be scoped to a vendor. Each case
 * keeps the local draft intact so nothing the vendor typed is lost — until "Start over"
 * signs them out, which abandons the draft and warns first. The dead ends carry it
 * because the header control is hidden while there is no vendor to enter the steps as.
 */
export function AccessNotice({ access, onSelectVendor, onSignOut }: AccessNoticeProps) {
  if (access.state === 'not-a-vendor') {
    return (
      <Shell icon={<UserXIcon className="size-5" />} title="This number is not a vendor account">
        <p className="text-sm leading-5 text-[var(--ob-ink-soft)]">
          The number you verified is registered, but it does not have vendor access. Sign in with a
          vendor number to continue setting up a store.
        </p>
        <Button variant="outline" size="sm" onClick={onSignOut}>Start over</Button>
      </Shell>
    )
  }

  if (access.state === 'vendor-not-provisioned') {
    return (
      <Shell icon={<BuildingIcon className="size-5" />} title="Your vendor account is not ready yet">
        <p className="text-sm leading-5 text-[var(--ob-ink-soft)]">
          Your number is verified as a vendor, but no store record has been created for it yet, so
          there is nothing to save your setup against.
        </p>
        <p className="text-sm leading-5 text-[var(--ob-ink-soft)]">
          Everything you have entered stays saved in this browser as long as you stay signed in.
          Please contact MithraDirect support to have your store created, then return here.
        </p>
        <Button variant="outline" size="sm" onClick={onSignOut}>Start over</Button>
      </Shell>
    )
  }

  if (access.state === 'vendor-selection-required') {
    return (
      <Shell icon={<StoreIcon className="size-5" />} title="Choose which store to set up">
        <p className="text-sm leading-5 text-[var(--ob-ink-soft)]">
          This number manages more than one store. Pick the one you want to configure — the rest are
          left untouched.
        </p>
        <ul className="space-y-2">
          {access.vendors.map((vendor) => (
            <li key={vendor.vendorId}>
              <Button
                variant="outline"
                fullWidth
                onClick={() => onSelectVendor(vendor.vendorId)}
              >
                {vendor.name ?? `Store ${vendor.vendorId}`}
              </Button>
            </li>
          ))}
        </ul>
      </Shell>
    )
  }

  return null
}

/**
 * The wizard's one step-level notice. Every message in Steps 3-10 has a fixed home by kind,
 * so a vendor learns where to look once:
 *
 * - how to fill the step: the step description under the title, never a box;
 * - what saving does that cannot be taken back: the save note beside Continue
 *   (`saveNote` in `ONBOARDING_STEPS`), so it is in view at the moment of the save;
 * - a plan limit: next to the list or counter it limits;
 * - the step cannot be used as it is: this notice, at the top of the step.
 *
 * Nothing a vendor must read before saving goes in a tooltip: it is invisible until found,
 * and unreliable on the phones most vendors set up from.
 */
export function StepNotice({
  message,
  tone = 'warning',
}: {
  message: string
  /** `info` for a state that holds the step back by design; `warning` for a problem. */
  tone?: 'info' | 'warning'
}) {
  const Icon = tone === 'info' ? ClockIcon : CircleAlertIcon
  return (
    <div
      role={tone === 'info' ? 'status' : undefined}
      className={tone === 'info'
        ? 'flex gap-2.5 rounded-lg border-l-2 border-l-[var(--ob-brand)] bg-[var(--ob-brand-soft)] py-2.5 pr-3 pl-3 text-sm leading-5'
        : 'flex gap-2.5 rounded-lg border-l-2 border-l-amber-500 bg-amber-50 py-2.5 pr-3 pl-3 text-sm leading-5 dark:bg-amber-950/35'}
    >
      <Icon
        className={tone === 'info' ? 'mt-0.5 size-4 shrink-0 text-[var(--ob-brand)]' : 'mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300'}
        aria-hidden="true"
      />
      <p className={tone === 'info' ? 'text-[var(--ob-ink)]' : 'text-amber-900 dark:text-amber-100'}>{message}</p>
    </div>
  )
}

/** A quiet status row for state that applies to the whole setup. */
export function OnboardingStatus({
  demo = false,
  submitted = false,
  approved = false,
}: {
  demo?: boolean
  submitted?: boolean
  approved?: boolean
}) {
  if (!demo && !submitted) return null

  const status = demo
    ? {
        label: 'Demo mode',
        detail: 'Changes stay in this browser.',
        Icon: DatabaseIcon,
        iconClassName: 'text-amber-700 dark:text-amber-300',
      }
    : approved
      ? {
          label: 'Approved',
          detail: 'You can add to your catalog; saved setup is locked.',
          Icon: CheckCircle2Icon,
          iconClassName: 'text-[var(--ob-brand)]',
        }
      : {
          label: 'Under review',
          detail: 'You can still add categories and products.',
          Icon: ClockIcon,
          iconClassName: 'text-[var(--ob-brand)]',
        }

  const { Icon, iconClassName } = status

  return (
    <div role="status" className="flex w-full items-center gap-2 py-2 text-xs leading-5 text-[var(--ob-ink-soft)]">
      <Icon className={`size-3.5 shrink-0 ${iconClassName}`} aria-hidden="true" />
      <p><span className="font-semibold text-[var(--ob-ink)]">{status.label}</span><span aria-hidden="true"> · </span>{status.detail}</p>
    </div>
  )
}
