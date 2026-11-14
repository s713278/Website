/** Host of the page that is open, without a trailing slash. */
export function publicSiteOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin.replace(/\/+$/, '')
}

/** Where a customer lands for one vendor's shop. */
export function storefrontUrl(storeIdentifier: string): string {
  return `${publicSiteOrigin()}/stores/${storeIdentifier}`
}

/** What a vendor reads out loud. The protocol is noise on a shop counter. */
export function readableUrl(url: string): string {
  return url.replace(/^https?:\/\//, '')
}
