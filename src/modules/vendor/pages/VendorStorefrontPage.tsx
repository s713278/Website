import { Link } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { StoreSharePanels } from '@/modules/vendor/components/StoreSharePanels'
import { StorefrontPreview } from '@/modules/vendor/components/onboarding/StorefrontPreview'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { useOnboardingStore } from '@/modules/vendor/store/onboarding-store'
import { Button, EmptyState } from '@/shared/components'

/**
 * The vendor's own store: the link customers open, and the code they scan.
 *
 * Two sources, because there is only one public storefront read and it `404`s until the
 * store goes live — the vendor who most wants a preview is exactly the one who cannot have
 * the real one:
 *
 * - **Open:** the live link, the QR for it, and the two ways to put it in front of someone.
 * - **Before that:** the draft held in this browser, clearly labelled as such. It is not
 *   the store, and on a different device it will not exist. Saying so is the point;
 *   pretending otherwise would be the dishonest option.
 */
export function VendorStorefrontPage() {
  const { storeState, context } = useVendorAccount()
  const draft = useOnboardingStore((s) => s.draft)
  const draftOwnerId = useOnboardingStore((s) => s.draftOwnerId)

  const identifier = context.storeIdentifier
  const isOpen = storeState === 'OPEN'
  const draftBelongsHere = draftOwnerId != null && draftOwnerId === context.vendorId

  if (isOpen && identifier) {
    return <StoreSharePanels identifier={identifier} storeName={context.businessName ?? 'your shop'} />
  }

  return (
    <div className="grid gap-4">
      <DashboardPanel title="Your store is not public yet">
        <p className="max-w-[68ch] text-sm text-[var(--md-muted)]">
          {storeState === 'SETTING_UP'
            ? 'Finish setup and send your store for review. Once it is accepted, customers can find it and this screen gives you the link and the QR code to share.'
            : 'Your store still has to be accepted before customers can find it. The link and the QR code appear here as soon as it is.'}
        </p>
        {storeState === 'SETTING_UP' ? (
          <div className="mt-4">
            <Link to="/onboarding">
              <Button size="sm" className="rounded-full">
                Continue setup
              </Button>
            </Link>
          </div>
        ) : null}
      </DashboardPanel>

      {draftBelongsHere ? (
        <DashboardPanel title="Your draft, on this device">
          <p className="mb-3.5 max-w-[68ch] text-sm text-[var(--md-muted)]">
            This is the draft saved in <strong>this browser</strong>. It is not your published
            store, and it will not appear on another device.
          </p>
          {/*
            Logo and banner are object URLs held only while the wizard is open, so a
            dashboard visit has neither. The preview falls back to its initials block,
            which is honest about what this browser actually still holds.
          */}
          <StorefrontPreview draft={draft} logoUrl={null} bannerUrl={null} />
        </DashboardPanel>
      ) : (
        <EmptyState
          title="No preview on this device"
          description="Your store's branding is saved to your account, but there is no read for it until the store is live — so a preview is only available in the browser where you set it up."
        />
      )}
    </div>
  )
}
