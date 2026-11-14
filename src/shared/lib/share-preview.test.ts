import { describe, expect, it } from 'vitest'
import {
  isShareCrawler,
  productShareCard,
  productShareTarget,
  shareImageUrl,
  shareCardLines,
  sharePreviewDocument,
} from './share-preview'

describe('product share card', () => {
  const card = productShareCard({
    name: 'Amla Pickle',
    storeName: 'SRK Traditional Foods and Pickles',
    unit: '4 kg',
    priceLabel: '₹400',
    description:
      'Amla Pickle is handcrafted using carefully selected ingredients. Popular among Instagram businesses.',
    image: 'https://mithradirect.com/cdn/amla.webp',
    url: 'https://mithradirect.com/stores/273/products/418?sku=6053',
  })

  it('describes the product and the shop', () => {
    expect(card.title).toBe('Amla Pickle')
    expect(card.priceLine).toBe('4 kg · ₹400')
    expect(card.siteName).toBe('SRK Traditional Foods and Pickles')
    expect(card.blurb).toBe('Amla Pickle is handcrafted using carefully selected ingredients.')
    expect(shareCardLines(card)).toBe(
      'Amla Pickle\n4 kg · ₹400\nSRK Traditional Foods and Pickles',
    )
  })

  it('puts the product in the preview document', () => {
    const html = sharePreviewDocument(card)
    expect(html).toContain('property="og:title" content="Amla Pickle"')
    expect(html).toContain('property="og:site_name" content="SRK Traditional Foods and Pickles"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(html).toContain('property="og:image" content="https://mithradirect.com/cdn/amla.webp"')
    expect(html).toContain('property="og:image:type" content="image/webp"')
    expect(html).toContain('property="og:image:secure_url" content="https://mithradirect.com/cdn/amla.webp"')
    expect(html).toContain('4 kg · ₹400')
    expect(html).not.toContain('MithraDirect')
  })

  it('asks Cloudflare for a JPEG so the chat can show the photo', () => {
    const source =
      'https://mithradirect.com/cdn-cgi/image/width=800,quality=85,format=auto,fit=contain,onerror=redirect/https://mithradirect-s3.example/Original_Amla_Pickle.webp'
    const image = shareImageUrl(source)

    expect(image).toBe(source.replace('format=auto', 'format=jpeg'))
    const html = sharePreviewDocument(
      productShareCard({
        name: 'Amla Pickle',
        storeName: 'Shop',
        image: source,
        url: 'https://mithradirect.com/stores/273/products/418',
      }),
    )
    expect(html).toContain('property="og:image:type" content="image/jpeg"')
    expect(html).toContain('format=jpeg')
    expect(html).not.toContain('format=auto')
  })

  it('escapes a name that would break the tag', () => {
    const html = sharePreviewDocument(
      productShareCard({ name: 'Tom & Jerry', storeName: 'Shop', url: 'https://example.test/p' }),
    )
    expect(html).toContain('content="Tom &amp; Jerry"')
    expect(html).toContain('name="twitter:card" content="summary"')
    expect(html).not.toContain('og:image')
  })
})

describe('share crawler routing', () => {
  it('reads a product path and ignores the rest of the site', () => {
    expect(productShareTarget('/stores/273/products/418')).toEqual({
      storeId: '273',
      productId: '418',
    })
    expect(productShareTarget('/stores/273')).toBeNull()
  })

  it('recognises preview crawlers', () => {
    expect(isShareCrawler('WhatsApp/2.23.20')).toBe(true)
    expect(isShareCrawler('facebookexternalhit/1.1')).toBe(true)
    expect(isShareCrawler('Mozilla/5.0 Chrome/120')).toBe(false)
  })
})
