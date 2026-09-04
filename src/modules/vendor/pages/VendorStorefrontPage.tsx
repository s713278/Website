import { Link } from 'react-router-dom'
import { StorefrontPreview } from '@/modules/vendor/components/onboarding/StorefrontPreview'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { useOnboardingStore } from '@/modules/vendor/store/onboarding-store'
import { Button, Card, EmptyState, PageHeader } from '@/shared/components'

/**
 * The vendor's own store, as customers see it.
 *
 * Two sources, because there is only one public storefront read and it `404`s until an
 * administrator approves the store — the vendor who most wants a preview is exactly the
 * one who cannot have the real one:
 *
 * - **Approved:** link to the live storefront customers actually reach.
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
    return (
      <div>
        <PageHeader
          title="Your storefront"
          subtitle="What customers see when they visit your store"
          actions={
            <Link to={`/stores/${identifier}`}>
              <Button size="sm">Open storefront</Button>
            </Link>
          }
        />
        <Card>
          <p className="text-sm text-[var(--md-muted)]">
            Your store is live and reachable by customers.
          </p>
          <p className="mt-2 text-sm">
            Share this link: <span className="font-medium">/stores/{identifier}</span>
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Your storefront" subtitle="Not visible to customers yet" />

      <Card className="mb-4">
        <h2 className="font-display font-semibold">Your store is not public yet</h2>
        <p className="mt-1 text-sm text-[var(--md-muted)]">
          {storeState === 'SETTING_UP'
            ? 'Finish setup and send your store for review. Once an administrator approves it, customers can find it.'
            : 'An administrator still has to approve your store before customers can find it.'}
        </p>
        {storeState === 'SETTING_UP' ? (
          <div className="mt-3">
            <Link to="/onboarding">
              <Button size="sm">Continue setup</Button>
            </Link>
          </div>
        ) : null}
      </Card>

      {draftBelongsHere ? (
        <>
          <p className="mb-3 text-sm text-[var(--md-muted)]">
            Below is the draft saved in <strong>this browser</strong>. It is not your published
            store, and it will not appear on another device.
          </p>
          {/*
            Logo and banner are object URLs held only while the wizard is open, so a
            dashboard visit has neither. The preview falls back to its initials block,
            which is honest about what this browser actually still holds.
          */}
          <StorefrontPreview draft={draft} logoUrl={null} bannerUrl={null} />
        </>
      ) : (
        <EmptyState
          title="No preview on this device"
          description="Your store's branding is saved to your account, but there is no read for it until the store is approved — so a preview is only available in the browser where you set it up."
        />
      )}
    </div>
  )
}
