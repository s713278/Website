import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from './cart-store'
import type { Product, ProductVariant } from '@/modules/storefront/types'

const pickle: Product = {
  id: '12',
  name: 'Mango Pickle',
  description: '',
  price: 180,
  veg: true,
  variants: [
    { id: '101', unit: '250 g', price: 180, onSale: false, skuType: 'ITEM' },
    { id: '102', unit: '500 g', price: 320, onSale: false, skuType: 'ITEM' },
  ],
}

const small: ProductVariant = pickle.variants![0]!
const large: ProductVariant = pickle.variants![1]!

describe('cart store SKU lines', () => {
  beforeEach(() => {
    const memory = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
      clear: () => memory.clear(),
    })
    useCartStore.getState().clear()
  })

  afterEach(() => {
    useCartStore.getState().clear()
    vi.unstubAllGlobals()
  })

  it('adds two sizes of the same product as separate lines', () => {
    useCartStore.getState().addItem('91', 'Shop', pickle, small, 1)
    useCartStore.getState().addItem('91', 'Shop', pickle, large, 2)

    const lines = useCartStore.getState().lines
    expect(lines.map((line) => ({ skuId: line.skuId, name: line.name, price: line.price, qty: line.qty }))).toEqual([
      { skuId: '101', name: 'Mango Pickle (250 g)', price: 180, qty: 1 },
      { skuId: '102', name: 'Mango Pickle (500 g)', price: 320, qty: 2 },
    ])
  })

  it('drops a stale variant from another product and adds this product default', () => {
    const mixed: Product = {
      id: '432',
      name: 'Mixed Vegetable Pickle',
      description: '',
      price: 210,
      veg: true,
      defaultVariantId: '4602',
      variants: [{ id: '4602', unit: '500 gr', price: 210, onSale: false, skuType: 'ITEM' }],
    }
    useCartStore.getState().addItem('91', 'Shop', mixed, large, 1)

    const [line] = useCartStore.getState().lines
    expect(line?.skuId).toBe('4602')
    expect(line?.name).toBe('Mixed Vegetable Pickle (500 gr)')
    expect(line?.price).toBe(210)
  })

  it('removes only the selected SKU', () => {
    useCartStore.getState().addItem('91', 'Shop', pickle, small, 1)
    useCartStore.getState().addItem('91', 'Shop', pickle, large, 2)

    expect(useCartStore.getState().lines).toHaveLength(2)
    useCartStore.getState().removeItem('12:101')

    const left = useCartStore.getState().lines
    expect(left).toHaveLength(1)
    expect(left[0]?.skuId).toBe('102')
    expect(left[0]?.qty).toBe(2)
  })
})
