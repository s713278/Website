import { BuildingIcon, CircleAlertIcon, ClockIcon, CloudOffIcon, StoreIcon, UserXIcon } from 'lucide-react'
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
 * A neutral step-level notice.
 *
 * Kept separate from `DraftOnlyNotice` because that one asserts where the data lives.
 * Saying "Saved in this browser only" about, say, a failed account read tells the vendor
 * something false about their store.
 */
export function StepNotice({ message }: { message: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg border-l-2 border-l-amber-500 bg-amber-50 py-2.5 pr-3 pl-3 text-sm leading-5 dark:bg-amber-950/35">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <p className="text-amber-900 dark:text-amber-100">{message}</p>
    </div>
  )
}

/**
 * Shown on the steps of a store that has already been sent for review.
 *
 * Deliberately not the amber `StepNotice`: nothing is wrong here. The vendor did the
 * thing setup asked of them, and read-only is the consequence of that, so it reads as a
 * status. It also says what happens next, because a vendor who cannot change anything
 * and is not told why will assume the page is broken.
 *
 * The variant tunes the copy to the step:
 * - `catalog` (Steps 4-5): a submitted store can still add categories and products within
 *   its plan limits, so the copy has to invite that rather than deny it — a vendor told
 *   "nothing can change" would never try to add.
 * - `sizes` (Step 6): sizes are read-only under review, because a new size cannot be
 *   created until the store is approved. The copy says so, so a vendor with a just-added,
 *   still-unpriced product knows why they cannot price it yet rather than assuming a bug.
 * - `locked` (Steps 3, 7-9): fully read-only, nothing to add.
 *
 * See `CONTEXT.md` ("Submitted").
 */
export function UnderReviewNotice({
  variant = 'locked',
}: {
  variant?: 'catalog' | 'sizes' | 'locked'
}) {
  return (
    <div role="status" className="flex gap-2.5 rounded-lg border-l-2 border-l-[var(--ob-brand)] bg-[var(--ob-brand-soft)] py-2.5 pr-3 pl-3 text-sm leading-5 text-[var(--ob-ink)]">
      <ClockIcon className="mt-0.5 size-4 shrink-0 text-[var(--ob-brand)]" aria-hidden="true" />
      {variant === 'catalog' ? (
        <p>
          <span className="font-semibold">Your store is under review. </span>
          You can still add categories and products within your plan limits, and each addition
          saves to your store. Everything else stays locked until an administrator decides.
        </p>
      ) : variant === 'sizes' ? (
        <p>
          <span className="font-semibold">Your store is under review. </span>
          Sizes and prices are locked for now — you can set them for any newly added product
          once an administrator approves your store. Contact MithraDirect support if something
          needs to change.
        </p>
      ) : (
        <p>
          <span className="font-semibold">Your store is with us for review. </span>
          You can look through everything you sent, but it cannot be changed from here while an
          administrator is deciding. Contact MithraDirect support if something needs to change.
        </p>
      )}
    </div>
  )
}

/**
 * Shown on steps that are fully usable but cannot yet be saved to the vendor account,
 * because their backend contract is unresolved. Deliberately specific: a vendor should
 * know what is and is not stored on their store.
 */
export function DraftOnlyNotice({ reason }: { reason: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg border-l-2 border-l-amber-500 bg-amber-50 py-2.5 pr-3 pl-3 text-sm leading-5 dark:bg-amber-950/35">
      <CloudOffIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <p className="text-amber-900 dark:text-amber-100">
        <span className="font-semibold">Saved in this browser only. </span>
        {reason}
      </p>
    </div>
  )
}
