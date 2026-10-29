/**
 * The address a customer types, which is not the address the vendor's browser is on.
 *
 * Every shop link the console hands out — the copied link, the QR a vendor prints and
 * sticks on a counter, the WhatsApp message — was built from `window.location.origin`, so
 * it read `localhost:5173` in development and the deployment hash on a Vercel preview. A
 * QR is the worst case: it gets printed, and a printed code pointing at a preview URL
 * outlives the deploy that made it.
 *
 * `VITE_PUBLIC_SITE_URL` is the one place that decides. It falls back to the current
 * origin so a clone with no `.env` still renders a working link rather than a broken one.
 */

function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

/** The public site's origin, without a trailing slash. */
export function publicSiteOrigin(): string {
  // Read per call rather than at module load, so a test can stub the variable and so a
  // build that injects it late is not answered from a value captured before it arrived.
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
  if (!configured) return currentOrigin()
  // A trailing slash here would produce `https://mithradirect.com//stores/…`, which works
  // but is what a vendor reads out loud and pastes into an Instagram bio.
  return configured.replace(/\/+$/, '')
}

/** Where a customer lands for one vendor's shop. */
export function storefrontUrl(storeIdentifier: string): string {
  return `${publicSiteOrigin()}/stores/${storeIdentifier}`
}

/** What a vendor reads out loud. The protocol is noise on a shop counter. */
export function readableUrl(url: string): string {
  return url.replace(/^https?:\/\//, '')
}
