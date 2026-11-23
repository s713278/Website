import { unwrapData } from '@mithra/api-client'

export type VendorImageKind = 'logo' | 'banner'
export type VendorImages = Record<VendorImageKind, string | null>

/** The read contract permits null even though the generated string schema does not. */
export function mapVendorImageUrl(payload: unknown): string | null {
  const data: unknown = unwrapData(payload)
  if (!data || typeof data !== 'object' || !('image_url' in data)) {
    throw new Error('Could not read the saved image. Please try again.')
  }
  if (data.image_url === null) return null
  if (typeof data.image_url === 'string') {
    try {
      const url = new URL(data.image_url)
      if (url.protocol === 'https:' || url.protocol === 'http:') return data.image_url
    } catch { /* Report a malformed response rather than treating it as an empty image. */ }
  }
  throw new Error('Could not read the saved image. Please try again.')
}
