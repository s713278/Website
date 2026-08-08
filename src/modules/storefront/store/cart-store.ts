import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartLine, Product } from '../types'

type CartState = {
  lines: CartLine[]
  addItem: (storeId: string, storeName: string, item: Product) => void
  removeItem: (itemId: string) => void
  setQty: (itemId: string, qty: number) => void
  clear: () => void
  itemCount: () => number
  subtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addItem(storeId, storeName, item) {
        const current = get().lines
        if (current.length && current[0].storeId !== storeId) {
          const replace = window.confirm(
            'Your cart has items from another store. Clear cart and add this item?',
          )
          if (!replace) return
          set({
            lines: [
              {
                itemId: item.id,
                storeId,
                storeName,
                name: item.name,
                price: item.price,
                qty: 1,
              },
            ],
          })
          return
        }
        const existing = current.find((line) => line.itemId === item.id)
        if (existing) {
          set({
            lines: current.map((line) =>
              line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line,
            ),
          })
          return
        }
        set({
          lines: [
            ...current,
            {
              itemId: item.id,
              storeId,
              storeName,
              name: item.name,
              price: item.price,
              qty: 1,
            },
          ],
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
      clear() {
        set({ lines: [] })
      },
      itemCount() {
        return get().lines.reduce((sum, line) => sum + line.qty, 0)
      },
      subtotal() {
        return get().lines.reduce((sum, line) => sum + line.price * line.qty, 0)
      },
    }),
    { name: 'md-cart' },
  ),
)
