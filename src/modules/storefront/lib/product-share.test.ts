import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  facebookShareHref,
  parseShareItems,
  SHARE_ITEM_LIMIT,
  shareListUrl,
  shareMessage,
  shareMessageUrl,
  type ShareItem,
} from './product-share'

const tomato: ShareItem = {
  productId: '423',
  skuId: '4404',
  name: 'Tomatoes',
  unit: '1 kg',
  priceLabel: '₹40',
}

const onion: ShareItem = {
  productId: '424',
  skuId: '4410',
  name: 'Onions',
  unit: '1 kg',
  priceLabel: '₹30',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function onSite(origin: string) {
  vi.stubGlobal('window', { location: { origin } })
}

describe('shareListUrl', () => {
  it('opens the product page for one item, including the selected size', () => {
    onSite('https://mithradirect.com')

    expect(shareListUrl('anithas-pickles', [tomato])).toBe(
      'https://mithradirect.com/stores/anithas-pickles/products/423?sku=4404',
    )
  })

  it('uses the shop and product from the page, on whatever host that page is open', () => {
    onSite('https://preview.example.test')

    expect(shareListUrl('srk-foods', [onion])).toBe(
      'https://preview.example.test/stores/srk-foods/products/424?sku=4410',
    )
  })

  it('opens the shop with every selected item when there is more than one', () => {
    onSite('https://mithradirect.com')

    expect(shareListUrl('anithas-pickles', [tomato, onion])).toBe(
      'https://mithradirect.com/stores/anithas-pickles?items=423.4404~424.4410',
    )
  })
})

describe('shareMessage', () => {
  it('names the shop once for a single product', () => {
    expect(shareMessage('Anitha\'s Pickles', [tomato], 'https://example.test/p')).toBe(
      'Tomatoes\n1 kg · ₹40\nAnitha\'s Pickles\n\nhttps://example.test/p#',
    )
  })

  it('lists every product under the shop name', () => {
    expect(shareMessage('Anitha\'s Pickles', [tomato, onion], 'https://example.test/s')).toBe(
      'Anitha\'s Pickles\n• Tomatoes (1 kg) — ₹40\n• Onions (1 kg) — ₹30\n\nhttps://example.test/s#',
    )
  })

  it('keeps a product name out of the sku query', () => {
    const url = 'https://mithradirect.com/stores/273/products/418?sku=6053'
    const message = shareMessage('SRK Traditional Foods and Pickles', [
      { productId: '418', skuId: '6053', name: 'Amla Pickle', unit: '4 kg', priceLabel: '₹400' },
    ], url)

    expect(shareMessageUrl(url)).toBe(`${url}#`)
    expect(message.endsWith(`${url}#`)).toBe(true)
    expect(message.includes('sku=6053Amla')).toBe(false)
  })
})

describe('parseShareItems', () => {
  it('reads product and size pairs and drops junk past the cap', () => {
    const raw = Array.from({ length: 12 }, (_, index) => `${index + 1}:${index + 100}`).join(',')

    expect(parseShareItems('423.4404~418.6053')).toEqual([
      { productId: '423', skuId: '4404' },
      { productId: '418', skuId: '6053' },
    ])

    const items = parseShareItems(`423:4404,424,423:4404,not an id,${raw}`)

    expect(items[0]).toEqual({ productId: '423', skuId: '4404' })
    expect(items[1]).toEqual({ productId: '424', skuId: undefined })
    expect(items).toHaveLength(SHARE_ITEM_LIMIT)
    expect(items.some((item) => item.productId === 'not an id')).toBe(false)
  })
})

describe('facebookShareHref', () => {
  it('opens Facebook with the product link', () => {
    expect(facebookShareHref('https://mithradirect.com/stores/anithas-pickles/products/423')).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmithradirect.com%2Fstores%2Fanithas-pickles%2Fproducts%2F423',
    )
  })
})
