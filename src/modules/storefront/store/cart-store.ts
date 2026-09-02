import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cartLineProductId } from '@/modules/storefront/lib/cart-utils'
import {
  buildCartLineSnapshot,
  findVariantForCartLine,
  resolveVariant,
  variantLineName,
} from '@/modules/storefront/lib/product-variants'
import type { CartLine, Product, ProductVariant } from '../types'

type CartState = {
  lines: CartLine[]
  addItem: (storeId: string, storeName: string, item: Product, variant?: ProductVariant, qty?: number) => void
  removeItem: (itemId: string) => void
  setQty: (itemId: string, qty: number) => void
  syncLinePrices: (products: Product[]) => void
  clear: () => void
  itemCount: (storeId?: string) => number
  subtotal: (storeId?: string) => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addItem(storeId, storeName, item, variant, qty = 1) {
        const resolved = resolveVariant(item, variant)
        const { itemId, name, price } = buildCartLineSnapshot(item, resolved)
        const current = get().lines
        const amount = Math.max(1, qty)

        if (current.length && current[0].storeId !== storeId) {
          const replace = window.confirm(
            'Your cart has items from another store. Clear cart and add this item?',
          )
          if (!replace) return
          set({
            lines: [{ itemId, storeId, storeName, name, price, qty: amount }],
          })
          return
        }

        const existing = current.find((line) => line.itemId === itemId)
        if (existing) {
          set({
            lines: current.map((line) =>
              line.itemId === itemId
                ? { ...line, qty: line.qty + amount, name, price }
                : line,
            ),
          })
          return
        }

        set({
          lines: [...current, { itemId, storeId, storeName, name, price, qty: amount }],
        })
      },
      removeItem(itemId) {
        set({ lines: get().lines.filter((line) => line.itemId !== itemId) })
      },
      setQty(itemId, qty) {
        if (qty <= 0) {
          get().removeItem(itemId)
          return
        }
        set({
          lines: get().lines.map((line) => (line.itemId === itemId ? { ...line, qty } : line)),
        })
      },
      syncLinePrices(products) {
        set({
          lines: get().lines.map((line) => {
            const product = products.find((entry) => entry.id === cartLineProductId(line.itemId))
            if (!product) return line
            const variant = findVariantForCartLine(product, line.itemId)
            if (!variant) return line
            return {
              ...line,
              price: variant.price,
              name: variantLineName(product.name, variant.unit),
            }
          }),
        })
      },
      clear() {
        set({ lines: [] })
      },
      itemCount(storeId) {
        const lines = get().lines
        const scoped = storeId ? lines.filter((line) => line.storeId === storeId) : lines
        return scoped.reduce((sum, line) => sum + line.qty, 0)
      },
      subtotal(storeId) {
        const lines = get().lines
        const scoped = storeId ? lines.filter((line) => line.storeId === storeId) : lines
        return scoped.reduce((sum, line) => sum + line.price * line.qty, 0)
      },
    }),
    { name: 'md-cart' },
  ),
)
