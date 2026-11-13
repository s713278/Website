/**
 * What a product share says. The page, the chat text, and the link preview
 * all use this, so a shared Amla jar does not show the MithraDirect homepage.
 */
export type ShareCard = {
  title: string
  priceLine: string
  blurb: string
  siteName: string
  image?: string
  url: string
}

const PRODUCT_PATH = /^\/stores\/([^/]+)\/products\/([^/]+)\/?$/
const CRAWLER =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|SkypeUriPreview|Iframely|redditbot/i

export function isShareCrawler(userAgent: string) {
  return CRAWLER.test(userAgent)
}

export function productShareTarget(pathname: string) {
  const match = PRODUCT_PATH.exec(pathname)
  if (!match?.[1] || !match[2]) return null
  return {
    storeId: decodeURIComponent(match[1]),
    productId: decodeURIComponent(match[2]),
  }
}

export function productShareCard(input: {
  name: string
  storeName: string
  unit?: string
  priceLabel?: string
  description?: string
  image?: string
  url: string
}): ShareCard {
  const priceLine = [input.unit?.trim(), input.priceLabel?.trim()].filter(Boolean).join(' · ')
  return {
    title: input.name.trim() || 'Product',
    priceLine,
    blurb: clip(firstSentence(input.description)),
    siteName: input.storeName.trim() || 'Shop',
    image: shareImageUrl(input.image),
    url: input.url,
  }
}

/** Price line, then a short product sentence. This is the preview description. */
export function shareCardText(card: ShareCard) {
  return [card.priceLine, card.blurb].filter(Boolean).join(' — ')
}

/** Chat text: product, price, shop. The link is added by the caller. */
export function shareCardLines(card: ShareCard) {
  return [card.title, card.priceLine, card.siteName].filter(Boolean).join('\n')
}

/** File type WhatsApp and Facebook read from `og:image:type`. */
export function imageMediaType(url: string): string {
  const options = /\/cdn-cgi\/image\/([^/]+)/.exec(url)?.[1] ?? ''
  if (options.includes('format=png')) return 'image/png'
  if (options.includes('format=gif')) return 'image/gif'
  if (options.includes('format=webp')) return 'image/webp'
  if (options.includes('format=jpeg') || options.includes('format=jpg')) return 'image/jpeg'
  const path = url.split(/[?#]/)[0]?.toLowerCase() ?? ''
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.gif')) return 'image/gif'
  if (path.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export function sharePreviewDocument(card: ShareCard) {
  const title = escapeHtml(card.title)
  const description = escapeHtml(shareCardText(card) || card.siteName)
  const site = escapeHtml(card.siteName)
  const url = escapeHtml(card.url)
  const preview = card.image ? 'summary_large_image' : 'summary'
  const image = card.image ? imageMeta(card.image) : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="product">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${site}">
<meta name="twitter:card" content="${preview}">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
${image}
</head>
<body>
<p>${title}</p>
<p>${description}</p>
<p>${site}</p>
</body>
</html>`
}

function imageMeta(image: string) {
  const safe = escapeHtml(image)
  const type = escapeHtml(imageMediaType(image))
  const secure = image.startsWith('https://')
    ? `\n<meta property="og:image:secure_url" content="${safe}">`
    : ''
  return `<meta property="og:image" content="${safe}">
<meta property="og:image:type" content="${type}">${secure}
<meta name="twitter:image" content="${safe}">`
}

function firstSentence(value: string | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim() ?? ''
  if (!text) return ''
  const dot = text.indexOf('. ')
  return dot === -1 ? text : text.slice(0, dot + 1)
}

function clip(value: string, max = 140) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

/**
 * A chat preview needs a JPEG. Cloudflare's `format=auto` answer is often WebP,
 * which WhatsApp shows as a bare address instead of a photo.
 */
export function shareImageUrl(url: string | undefined): string | undefined {
  if (!url || !/^https?:\/\//.test(url)) return undefined
  if (!url.includes('/cdn-cgi/image/')) return url
  return url.replaceAll('format=auto', 'format=jpeg')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
