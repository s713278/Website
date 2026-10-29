import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCustomerSessionCaches } from './customer-session-cache'
import { savePendingCartAdd, readPendingCartAdd } from './pending-cart-add'
import { CART_STORAGE_KEY, useCartStore } from '@/modules/storefront/store/cart-store'

describe('clearCustomerSessionCaches', () => {
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
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => memory.get(`s:${key}`) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(`s:${key}`, value)
      },
      removeItem: (key: string) => {
        memory.delete(`s:${key}`)
      },
    })
    useCartStore.getState().clear()
  })

  afterEach(() => {
    useCartStore.getState().clear()
    vi.unstubAllGlobals()
  })

  it('clears cart memory, persist, and pending add', () => {
    useCartStore.getState().addPendingLine({
      vendorId: '91',
      storeName: 'Shop',
      productId: '12',
      skuId: '101',
      qty: 1,
      name: 'Pickle',
      label: '250 g',
      price: 180,
      returnTo: '/stores/91',
    })
    localStorage.setItem(CART_STORAGE_KEY, '{"state":{"lines":[]}}')
    savePendingCartAdd({
      vendorId: '91',
      storeName: 'Shop',
      productId: '12',
      skuId: '101',
      qty: 1,
      name: 'Pickle',
      label: '250 g',
      price: 180,
      returnTo: '/stores/91',
    })

    clearCustomerSessionCaches()

    expect(useCartStore.getState().lines).toEqual([])
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
    expect(readPendingCartAdd()).toBeNull()
  })
})
