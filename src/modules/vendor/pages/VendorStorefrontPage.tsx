import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Link } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { StorefrontPreview } from '@/modules/vendor/components/onboarding/StorefrontPreview'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { useOnboardingStore } from '@/modules/vendor/store/onboarding-store'
import { Button, EmptyState } from '@/shared/components'
import { readableUrl, storefrontUrl } from '@/shared/lib/store-link'

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

/**
 * The link, and the three ways out of this screen with it.
 *
 * Copy reports what happened rather than assuming: `navigator.clipboard` is unavailable on
 * an insecure origin and can be refused by permission, and a hint reading "Copied" over an
 * empty clipboard is the one failure a vendor cannot see for themselves.
 */
function ShopLinkPanel({ identifier }: { identifier: string }) {
  const url = storefrontUrl(identifier)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  useEffect(() => {
    if (copied === 'idle') return
    const timer = window.setTimeout(() => setCopied('idle'), 4000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  const whatsApp = `https://wa.me/?text=${encodeURIComponent(`Order from my shop: ${url}`)}`

  return (
    <DashboardPanel title="Your shop link">
      <p className="mb-3.5 max-w-[68ch] text-sm text-[var(--md-muted)]">
        Customers open this link to browse and order on WhatsApp. Share it on WhatsApp and put
        it in your Instagram bio.
      </p>

      <div className="flex items-center gap-2.5 rounded-[var(--vc-radius)] border border-[var(--vc-tint-line)] bg-[var(--vc-tint)] px-3.5 py-3">
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--vc-tint-ink)]">
          {readableUrl(url)}
        </span>
        <Button size="sm" className="rounded-full" onClick={() => void copy()}>
          Copy
        </Button>
      </div>

      {/*
        `role="status"` rather than a toast: the hint belongs beside the thing it is about,
        and a vendor who has just tapped Copy is looking at exactly this line.
      */}
      <p role="status" className="mt-2 min-h-4 text-xs font-semibold text-[var(--vc-tint-ink)]">
        {copied === 'done' ? 'Copied — paste in WhatsApp or Instagram bio.' : null}
        {copied === 'failed' ? (
          <span className="text-[var(--md-danger)]">
            This browser would not let the page copy. Select the link above and copy it.
          </span>
        ) : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-2.5">
        <a href={whatsApp} target="_blank" rel="noreferrer">
          <Button className="rounded-full">Share on WhatsApp</Button>
        </a>
        <Link to={`/stores/${identifier}`}>
          <Button variant="outline" className="rounded-full">
            Open storefront
          </Button>
        </Link>
      </div>
    </DashboardPanel>
  )
}

/**
 * The counter QR.
 *
 * Encoded in the browser from the same link above, so the code and the link can never
 * disagree, and nothing about the vendor's shop is sent anywhere to draw it.
 *
 * Deep green on white rather than black: it is the one piece of this console that gets
 * printed and stuck on a shop wall, and it should look like it came from the brand. Error
 * correction stays at the library's default `M` — a code that survives a thumbprint.
 */
function ShopQrPanel({ identifier, storeName }: { identifier: string; storeName: string }) {
  const url = storefrontUrl(identifier)
  // `identifier` rather than the store name: a file called `anitha's pickles!.png` is a
  // file a vendor has to rename before they can send it anywhere.
  const fileName = `${identifier}-qr.png`
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [shareable, setShareable] = useState<File | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setError('')
    setShareable(null)

    void QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      color: { dark: '#064e3bff', light: '#ffffffff' },
    })
      .then(async (encoded) => {
        if (cancelled) return
        setDataUrl(encoded)

        // Whether the Share button appears is decided against the real file, not against a
        // feature flag: a device can have `navigator.share` and still refuse a PNG, and a
        // share button that opens nothing is worse than no share button. Failing here
        // costs the vendor the second button and nothing else, so it never sets `error`.
        try {
          const blob = await (await fetch(encoded)).blob()
          const file = new File([blob], fileName, { type: 'image/png' })
          if (!cancelled && navigator.canShare?.({ files: [file] })) setShareable(file)
        } catch {
          /* Saving the image still works; only the share sheet is unavailable. */
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not draw the QR code. The link above still works.')
      })

    return () => {
      cancelled = true
    }
  }, [url, fileName])

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: `${storeName} — scan to order` })
    } catch {
      // Includes the vendor dismissing the share sheet, which is not an error to report.
    }
  }

  return (
    <DashboardPanel className="bg-[image:var(--vc-spotlight)] shadow-[var(--vc-shadow-lift)]">
      <div className="grid gap-5 sm:grid-cols-[11rem_1fr] sm:items-center">
        <div className="mx-auto flex size-44 items-center justify-center overflow-hidden rounded-[var(--vc-radius)] border border-[var(--vc-tint-line)] bg-white shadow-[var(--vc-shadow)] sm:mx-0">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`QR code linking to ${storeName}`}
              className="size-full object-contain p-2"
            />
          ) : (
            <span className="vc-label">{error ? 'No code' : 'Drawing…'}</span>
          )}
        </div>

        <div className="text-center sm:text-left">
          <p className="text-[0.7rem] font-bold tracking-wider uppercase text-[var(--vc-tint-ink)]">
            Scan &amp; order
          </p>
          <h2 className="font-display mt-0.5 text-lg font-semibold">Put this on your counter</h2>
          <p className="mt-1.5 max-w-[60ch] text-sm text-slate-600">
            Print or save this QR. Customers scan it with their phone camera and land on your
            shop — no typing, no app needed.
          </p>
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-left text-xs text-[var(--md-muted)]">
            <li>Stick it on packaging or your shop table</li>
            <li>Show it in WhatsApp status or Stories</li>
            <li>Keep it next to the UPI or cash counter</li>
          </ul>

          {error ? (
            <p className="mt-3 text-sm text-[var(--md-danger)]">{error}</p>
          ) : (
            <div className="mt-3.5 flex flex-wrap justify-center gap-2 sm:justify-start">
              <a href={dataUrl ?? undefined} download={fileName}>
                <Button size="sm" className="rounded-full" disabled={!dataUrl}>
                  Save QR image
                </Button>
              </a>
              {/*
                Only where the device can actually hand a file to another app. On a laptop
                `navigator.share` is usually absent, and a button that opens nothing is
                worse than one that is not there — a vendor taps it once and stops trusting
                the screen. This is the control the phone in their apron pocket wants.
              */}
              {shareable ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void share(shareable)}
                >
                  Share QR
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </DashboardPanel>
  )
}

export function VendorStorefrontPage() {
  const { storeState, context } = useVendorAccount()
  const draft = useOnboardingStore((s) => s.draft)
  const draftOwnerId = useOnboardingStore((s) => s.draftOwnerId)

  const identifier = context.storeIdentifier
  const isOpen = storeState === 'OPEN'
  const draftBelongsHere = draftOwnerId != null && draftOwnerId === context.vendorId

  if (isOpen && identifier) {
    return (
      <div className="grid gap-4">
        <ShopLinkPanel identifier={identifier} />
        <ShopQrPanel identifier={identifier} storeName={context.businessName ?? 'your shop'} />
      </div>
    )
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
