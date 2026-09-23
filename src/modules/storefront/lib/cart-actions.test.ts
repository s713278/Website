import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api'
import { cartService } from '@/shared/api/services/cart.service'
import type { CartSnapshot } from '@/shared/api/mappers/cart'
import { addToVendorCart, hydrateVendorCart, invalidateCartWrites, setVendorCartQty } from './cart-actions'
import { resetVendorCartQueue } from './vendor-cart-queue'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { CartLine, Product, ProductVariant } from '@/modules/storefront/types'

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api')>()
  return { ...actual, isLiveApi: () => true }
})

const milk: Product = {
  id: '1',
  name: 'Milk',
  description: '',
  price: 50,
  veg: true,
  variants: [{ id: '11', unit: '1 L', price: 50, onSale: false, skuType: 'ITEM' }],
}

const bread: Product = {
  id: '2',
  name: 'Bread',
  description: '',
  price: 40,
  veg: true,
  variants: [{ id: '22', unit: '400 g', price: 40, onSale: false, skuType: 'ITEM' }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function snapshot(items: Array<{ skuId: string; cartItemId: string; name: string; qty?: number }>): CartSnapshot {
  const lines: CartLine[] = items.map((item) => ({
    itemId: item.skuId,
    storeId: '91',
    storeName: 'Shop',
    name: item.name,
    price: 10,
    qty: item.qty ?? 1,
    lineTotal: 10 * (item.qty ?? 1),
    cartItemId: item.cartItemId,
    skuId: item.skuId,
  }))
  return {
    cartId: 'c1',
    vendorId: '91',
    lines,
    summary: {
      itemsTotal: lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0),
      deliveryCharges: 0,
      discount: 0,
      serviceCharge: 0,
      grandTotal: lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0),
      itemsCount: lines.length,
      totalQuantity: lines.reduce((sum, line) => sum + line.qty, 0),
    },
    expiresAt: null,
  }
}

describe('vendor cart actions', () => {
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
    resetVendorCartQueue()
    useCartStore.getState().clear()
  })

  afterEach(() => {
    resetVendorCartQueue()
    useCartStore.getState().clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does not let a slower first add wipe a later item', async () => {
    const first = deferred<CartSnapshot>()
    const second = deferred<CartSnapshot>()
    let calls = 0
    vi.spyOn(cartService, 'addItem').mockImplementation(() => {
      calls += 1
      return calls === 1 ? first.promise : second.promise
    })

    const addingMilk = addToVendorCart({
      vendorId: '91',
      storeName: 'Shop',
      product: milk,
      variant: milk.variants![0] as ProductVariant,
    })
    const addingBread = addToVendorCart({
      vendorId: '91',
      storeName: 'Shop',
      product: bread,
      variant: bread.variants![0] as ProductVariant,
    })

    second.resolve(snapshot([
      { skuId: '11', cartItemId: 'c1', name: 'Milk' },
      { skuId: '22', cartItemId: 'c2', name: 'Bread' },
    ]))
    first.resolve(snapshot([{ skuId: '11', cartItemId: 'c1', name: 'Milk' }]))

    await Promise.all([addingMilk, addingBread])

    const skuIds = useCartStore.getState().lines.map((line) => line.skuId).sort()
    expect(skuIds).toEqual(['11', '22'])
  })

  it('refreshes instead of clearing when a line is already gone', async () => {
    useCartStore.getState().replaceVendorCart(
      '91',
      [
        {
          itemId: '1:11',
          storeId: '91',
          storeName: 'Shop',
          name: 'Milk (1 L)',
          price: 50,
          qty: 2,
          productId: '1',
          skuId: '11',
          cartItemId: 'stale',
        },
      ],
    )

    vi.spyOn(cartService, 'setItemQty').mockRejectedValue(
      new ApiError('The specified item was not found in cart', 404, {
        user_message: 'The specified item was not found in cart',
      }),
    )
    vi.spyOn(cartService, 'get').mockResolvedValue(
      snapshot([{ skuId: '22', cartItemId: 'c2', name: 'Bread' }]),
    )

    await setVendorCartQty('91', '1:11', 3, 'Shop')

    const lines = useCartStore.getState().lines
    expect(lines).toHaveLength(1)
    expect(lines[0]?.skuId).toBe('22')
  })

  it('replaces leftover local names from the server after login', async () => {
    useCartStore.getState().replaceVendorCart(
      '91',
      [
        {
          itemId: '423:4404',
          storeId: '91',
          storeName: 'Shop',
          name: 'Garlic Pickle (500 gr)',
          price: 30,
          qty: 2,
          productId: '423',
          skuId: '4404',
        },
      ],
    )
    vi.spyOn(cartService, 'get').mockResolvedValue(
      snapshot([{ skuId: '4404', cartItemId: 'c9', name: 'Biryani Masala', qty: 2 }]),
    )

    await hydrateVendorCart('91', 'Shop', [
      {
        id: '423',
        name: 'Biryani Masala',
        description: '',
        price: 30,
        veg: true,
        defaultVariantId: '4404',
        variants: [{ id: '4404', unit: '1 pcs', price: 30, onSale: false, skuType: 'ITEM' }],
      },
    ])

    expect(useCartStore.getState().lines[0]?.name).toBe('Biryani Masala (1 pcs)')
  })

  it('adds Mixed Vegetable even if the control still holds Amla 1 kg', async () => {
    const mixed: Product = {
      id: '432',
      name: 'Mixed Vegetable Pickle',
      description: '',
      price: 210,
      veg: true,
      defaultVariantId: '4602',
      variants: [{ id: '4602', unit: '500 gr', price: 210, onSale: false, skuType: 'ITEM' }],
    }
    const addItem = vi.spyOn(cartService, 'addItem').mockImplementation(async (_vendorId, input) =>
      snapshot([
        { skuId: '4152', cartItemId: 'c1', name: 'Amla Pickle', qty: 2 },
        { skuId: String(input.skuId), cartItemId: 'c2', name: 'Item', qty: 1 },
      ]),
    )

    await addToVendorCart({
      vendorId: '273',
      storeName: 'Shop',
      product: mixed,
      variant: { id: '4152', unit: '1 KG', price: 450, onSale: false, skuType: 'ITEM' },
    })

    expect(addItem).toHaveBeenCalledWith('273', { skuId: '4602', quantity: 1 }, 'Shop')
    const added = useCartStore.getState().lines.find((line) => line.skuId === '4602')
    expect(added?.name).toBe('Mixed Vegetable Pickle (500 gr)')
  })

  it('labels 1 kg and 2 kg from the size that was tapped', async () => {
    const pickle: Product = {
      id: '88',
      name: 'Amla Pickle',
      description: '',
      price: 240,
      veg: true,
      defaultVariantId: '201',
      variants: [
        { id: '201', unit: '1 kg', price: 240, onSale: false, skuType: 'ITEM' },
        { id: '202', unit: '2 kg', price: 450, onSale: false, skuType: 'ITEM' },
      ],
    }
    vi.spyOn(cartService, 'addItem').mockImplementation(async (_vendorId, input) =>
      snapshot([
        { skuId: '201', cartItemId: 'c1', name: 'Amla Pickle', qty: 2 },
        ...(String(input.skuId) === '202'
          ? [{ skuId: '202', cartItemId: 'c2', name: 'Amla Pickle', qty: 2 }]
          : []),
      ]),
    )

    await addToVendorCart({
      vendorId: '91',
      storeName: 'Shop',
      product: pickle,
      variant: pickle.variants![0] as ProductVariant,
      qty: 2,
    })
    await addToVendorCart({
      vendorId: '91',
      storeName: 'Shop',
      product: pickle,
      variant: pickle.variants![1] as ProductVariant,
      qty: 2,
    })

    const lines = useCartStore.getState().lines
    expect(lines.map((line) => ({ skuId: line.skuId, name: line.name, qty: line.qty }))).toEqual([
      { skuId: '201', name: 'Amla Pickle (1 kg)', qty: 2 },
      { skuId: '202', name: 'Amla Pickle (2 kg)', qty: 2 },
    ])
  })

  it('drops a late add after logout invalidates cart writes', async () => {
    const first = deferred<CartSnapshot>()
    vi.spyOn(cartService, 'addItem').mockReturnValue(first.promise)

    const adding = addToVendorCart({
      vendorId: '91',
      storeName: 'Shop',
      product: milk,
      variant: milk.variants![0] as ProductVariant,
    })
    await Promise.resolve()

    invalidateCartWrites()
    first.resolve(snapshot([{ skuId: '11', cartItemId: 'c1', name: 'Milk' }]))
    await adding

    expect(useCartStore.getState().lines).toEqual([])
  })
})
