import { storePath, storeProductPath } from '@/modules/storefront/lib/store-paths'
import { productShareCard, shareCardLines, shareImageUrl } from '@/shared/lib/share-preview'
import { formatCurrency } from '@/shared/lib/utils'

/** A WhatsApp status stays readable, and the shared URL stays short. */
export const SHARE_ITEM_LIMIT = 10

export type ShareItem = {
  productId: string
  skuId?: string
  name: string
  unit?: string
  priceLabel: string
  description?: string
  imageUrl?: string
}

export type ShareTarget = {
  productId: string
  skuId?: string
}

const ID = /^[A-Za-z0-9_-]+$/

export function shareItemFromSelection(
  product: { id: string; name: string; description?: string; imageUrl?: string },
  variant: { id: string; unit?: string; price: number },
): ShareItem {
  const skuId = variant.id && variant.id !== 'default' ? variant.id : undefined
  return {
    productId: product.id,
    skuId,
    name: product.name,
    unit: variant.unit?.trim() || undefined,
    priceLabel: formatCurrency(variant.price),
    description: product.description?.trim() || undefined,
    imageUrl: product.imageUrl,
  }
}

function line(item: ShareItem) {
  const size = item.unit ? ` (${item.unit})` : ''
  return `${item.name}${size} — ${item.priceLabel}`
}

/**
 * `423.4404~418.6053` — dot and tilde stay literal, so WhatsApp treats the whole
 * address as one link. A comma or colon would be encoded (`%2C`, `%3A`) and the
 * chat shows a dead string.
 */
function packShareItems(items: ShareItem[]) {
  return items
    .map((item) => (item.skuId ? `${item.productId}.${item.skuId}` : item.productId))
    .join('~')
}

/**
 * WhatsApp keeps letters after a query value inside the link, so
 * `?sku=6053` followed by the product name becomes `?sku=6053Amla`.
 * A hash takes that word out of `sku`.
 */
export function shareMessageUrl(url: string) {
  return url.includes('#') ? url : `${url}#`
}

/** Host of the page the customer is sharing from. The store and product are added after it. */
function pageOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin.replace(/\/+$/, '')
}

/** One item opens the product page. Several items open the shop with `?items=`. */
export function shareListUrl(storeId: string, items: ShareItem[]): string {
  const list = items.slice(0, SHARE_ITEM_LIMIT)
  const origin = pageOrigin()
  if (list.length === 1) {
    const item = list[0]
    return `${origin}${storeProductPath(storeId, item.productId, item.skuId)}`
  }
  if (list.length === 0) return `${origin}${storePath(storeId)}`
  return `${origin}${storePath(storeId)}?items=${packShareItems(list)}`
}

export function shareMessage(storeName: string, items: ShareItem[], url: string) {
  const list = items.slice(0, SHARE_ITEM_LIMIT)
  const link = shareMessageUrl(url)
  if (list.length === 0) return link
  if (list.length === 1) {
    const item = list[0]
    const card = productShareCard({
      name: item.name,
      storeName,
      unit: item.unit,
      priceLabel: item.priceLabel,
      image: item.imageUrl,
      url,
    })
    return `${shareCardLines(card)}\n\n${link}`
  }
  const lines = list.map((item) => `• ${line(item)}`).join('\n')
  return `${storeName}\n${lines}\n\n${link}`
}

function imageFileName(title: string, type: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product'
  const subtype = type.slice('image/'.length).split('+')[0]?.split(';')[0] || 'jpeg'
  return `${base}.${subtype === 'jpeg' ? 'jpg' : subtype}`
}

/**
 * Phones that accept an image file get the product photo in the share sheet.
 * A desktop chat link cannot carry a file, so the caller keeps the text link.
 */
export async function shareWithImage(input: {
  title: string
  text: string
  imageUrl?: string
}): Promise<'shared' | 'unavailable' | 'dismissed'> {
  const image = shareImageUrl(input.imageUrl)
  if (!image || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unavailable'
  }
  try {
    const response = await fetch(image)
    if (!response.ok) return 'unavailable'
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return 'unavailable'
    const file = new File([blob], imageFileName(input.title, blob.type), { type: blob.type })
    if (!navigator.canShare?.({ files: [file] })) return 'unavailable'
    await navigator.share({ files: [file], text: input.text, title: input.title })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'dismissed'
    return 'unavailable'
  }
}

export function facebookShareHref(url: string, quote?: string) {
  const params = new URLSearchParams({ u: url })
  if (quote) params.set('quote', quote)
  return `https://www.facebook.com/sharer/sharer.php?${params}`
}

/** Instagram has no link-share URL. The product page copies the message, then opens Instagram. */
export const INSTAGRAM_URL = 'https://www.instagram.com/'

/** `423.4404~418.6053` or the older `423:4404,418:6053`. */
export function parseShareItems(raw: string | null): ShareTarget[] {
  if (!raw) return []
  const seen = new Set<string>()
  const items: ShareTarget[] = []
  for (const part of raw.split(/[~,]/)) {
    const dot = part.indexOf('.')
    const colon = part.indexOf(':')
    const separator = dot === -1 ? colon : colon === -1 ? dot : Math.min(dot, colon)
    const productId = (separator === -1 ? part : part.slice(0, separator)).trim()
    const skuRaw = separator === -1 ? '' : part.slice(separator + 1).trim()
    if (!ID.test(productId)) continue
    const skuId = skuRaw && ID.test(skuRaw) ? skuRaw : undefined
    const key = `${productId}:${skuId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ productId, skuId })
    if (items.length >= SHARE_ITEM_LIMIT) break
  }
  return items
}

/** Desktop opens WhatsApp Web. A phone opens the app. No WhatsApp install is required on a PC. */
export function whatsappShareHref(message: string) {
  const mobile =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const base = mobile ? 'https://api.whatsapp.com/send' : 'https://web.whatsapp.com/send'
  return `${base}?${new URLSearchParams({ text: message })}`
}
