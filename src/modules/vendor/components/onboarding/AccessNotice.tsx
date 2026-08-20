import { BuildingIcon, CloudOffIcon, StoreIcon, UserXIcon } from 'lucide-react'
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
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
        <div className="space-y-2">
          <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Shown instead of Steps 3-10 when the session cannot be scoped to a vendor. Each case
 * keeps the local draft intact so nothing the vendor typed is lost.
 */
export function AccessNotice({ access, onSelectVendor, onSignOut }: AccessNoticeProps) {
  if (access.state === 'not-a-vendor') {
    return (
      <Shell icon={<UserXIcon className="size-5" />} title="This number is not a vendor account">
        <p className="text-sm leading-5 text-muted-foreground">
          The number you verified is registered, but it does not have vendor access. Sign in with a
          vendor number to continue setting up a store.
        </p>
        <Button variant="outline" size="sm" onClick={onSignOut}>Use a different number</Button>
      </Shell>
    )
  }

  if (access.state === 'vendor-not-provisioned') {
    return (
      <Shell icon={<BuildingIcon className="size-5" />} title="Your vendor account is not ready yet">
        <p className="text-sm leading-5 text-muted-foreground">
          Your number is verified as a vendor, but no store record has been created for it yet, so
          there is nothing to save your setup against.
        </p>
        <p className="text-sm leading-5 text-muted-foreground">
          Everything you have entered stays saved in this browser. Please contact MithraDirect
          support to have your store created, then return here.
        </p>
        <Button variant="outline" size="sm" onClick={onSignOut}>Use a different number</Button>
      </Shell>
    )
  }

  if (access.state === 'vendor-selection-required') {
    return (
      <Shell icon={<StoreIcon className="size-5" />} title="Choose which store to set up">
        <p className="text-sm leading-5 text-muted-foreground">
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
 * Shown on steps that are fully usable but cannot yet be saved to the vendor account,
 * because their backend contract is unresolved. Deliberately specific: a vendor should
 * know what is and is not stored on their store.
 */
export function DraftOnlyNotice({ reason }: { reason: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm leading-5 dark:border-amber-400/30 dark:bg-amber-950/30">
      <CloudOffIcon className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <p className="text-amber-900 dark:text-amber-100">
        <span className="font-semibold">Saved in this browser only. </span>
        {reason}
      </p>
    </div>
  )
}
