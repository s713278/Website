import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Link } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { Button } from '@/shared/components'
import { readableUrl, storefrontUrl } from '@/shared/lib/store-link'

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

/** The link and QR panels shared by the dashboard and approved setup Step 10. */
export function StoreSharePanels({
  identifier,
  storeName,
}: {
  identifier: string
  storeName: string
}) {
  return (
    <div className="store-share-scope grid gap-4">
      <ShopLinkPanel identifier={identifier} />
      <ShopQrPanel identifier={identifier} storeName={storeName} />
    </div>
  )
}
