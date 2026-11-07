import { afterEach, describe, expect, it, vi } from 'vitest'
import { productCrawlerHtml } from './share-crawler'

const product = {
  product_name: 'Amla Pickle',
  product_description:
    'Amla Pickle is handcrafted using carefully selected ingredients. Popular among Instagram businesses.',
  product_image_path: 'https://mithradirect.com/cdn/amla.webp',
  default_sku_id: 6053,
  variants: [
    { sku_id: 6053, quantity_value: 4, unit: 'kg', sale_price: 400 },
    { sku_id: 4152, quantity_value: 1, unit: 'KG', sale_price: 450 },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('productCrawlerHtml', () => {
  it('returns the product for a preview crawler', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = String(url).includes('/products/')
          ? { data: product }
          : { data: { business_name: 'SRK Traditional Foods and Pickles' } }
        return new Response(JSON.stringify(body), { status: 200 })
      }),
    )

    const html = await productCrawlerHtml(
      new Request('https://mithradirect.com/stores/273/products/418?sku=6053Amla', {
        headers: { 'user-agent': 'WhatsApp/2.23' },
      }),
      'https://qa.mithradirect.com/api',
    )

    expect(html).toContain('og:title" content="Amla Pickle"')
    expect(html).toContain('4 kg')
    expect(html).toContain('₹400')
    expect(html).toContain('SRK Traditional Foods and Pickles')
    expect(html).toContain('https://mithradirect.com/cdn/amla.webp')
    expect(html).not.toContain('MithraDirect')
    expect(html).not.toContain('6053Amla')
  })

  it('leaves a normal browser to the app', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const html = await productCrawlerHtml(
      new Request('https://mithradirect.com/stores/273/products/418', {
        headers: { 'user-agent': 'Mozilla/5.0 Chrome/120' },
      }),
      'https://qa.mithradirect.com/api',
    )
    expect(html).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
