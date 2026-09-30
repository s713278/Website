import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PendingCartAdd } from '@/modules/storefront/lib/pending-cart-add'
import { findVendorCartLine, isSameCartSku } from '@/modules/storefront/lib/cart-line-match'
import {
  buildCartLineSnapshot,
  resolveOwnedVariant,
  variantCartId,
  variantLineName,
} from '@/modules/storefront/lib/product-variants'
import type { CartLine, CartSummary, Product, ProductVariant } from '../types'

export const CART_STORAGE_KEY = 'md-cart'

/** Demo / interim bill when API `cart_summary` is not stored yet. */
export function summaryFromLines(lines: CartLine[]): CartSummary {
  const itemsTotal = lines.reduce(
    (sum, line) => sum + (line.lineTotal ?? line.price * line.qty),
    0,
  )
  const totalQuantity = lines.reduce((sum, line) => sum + line.qty, 0)
  return {
    itemsTotal,
    deliveryCharges: 0,
    discount: 0,
    serviceCharge: 0,
    grandTotal: itemsTotal,
    itemsCount: lines.length,
    totalQuantity,
  }
}

type CartState = {
  lines: CartLine[]
  /** Per-vendor totals from API `cart_summary` (or interim from lines). */
  summaries: Record<string, CartSummary>
  replaceVendorCart: (vendorId: string, lines: CartLine[], summary?: CartSummary) => void
  findLine: (vendorId: string, itemId: string) => CartLine | undefined
  clearVendor: (vendorId: string) => void
  addItem: (
    storeId: string,
    storeName: string,
    item: Product,
    variant?: ProductVariant,
    qty?: number,
  ) => void
  addPendingLine: (pending: PendingCartAdd) => void
  removeItem: (itemId: string) => void
  setQty: (itemId: string, qty: number) => void
  clear: () => void
  itemCount: (storeId?: string) => number
  subtotal: (storeId?: string) => number
}

function upsertLine(
  current: CartLine[],
  next: Omit<CartLine, 'qty'> & { qty: number },
): CartLine[] {
  const existing = current.find((line) => isSameCartSku(line, next))
  if (!existing) {
    return [...current, { ...next, lineTotal: next.lineTotal ?? next.price * next.qty }]
  }

  return current.map((line) => {
    if (line !== existing) return line
    const qty = line.qty + next.qty
    const price = next.price || line.price
    return {
      ...line,
      ...next,
      qty,
      price,
      lineTotal: price * qty,
      cartItemId: line.cartItemId ?? next.cartItemId,
      productId: next.productId ?? line.productId,
      skuId: next.skuId ?? line.skuId,
    }
  })
}

function putSummary(
  lines: CartLine[],
  summaries: Record<string, CartSummary>,
  vendorId: string,
  summary?: CartSummary,
): Record<string, CartSummary> {
  const vendorLines = lines.filter((line) => line.storeId === vendorId)
  if (vendorLines.length === 0) {
    const next = { ...summaries }
    delete next[vendorId]
    return next
  }
  return {
    ...summaries,
    [vendorId]: summary ?? summaryFromLines(vendorLines),
  }
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      summaries: {},

      replaceVendorCart(vendorId, lines, summary) {
        const nextLines = [
          ...get().lines.filter((line) => line.storeId !== vendorId),
          ...lines,
        ]
        set({
          lines: nextLines,
          summaries: putSummary(nextLines, get().summaries ?? {}, vendorId, summary),
        })
      },

      findLine(vendorId, itemId) {
        return findVendorCartLine(get().lines, vendorId, itemId)
      },

      clearVendor(vendorId) {
        const { [vendorId]: _, ...rest } = get().summaries ?? {}
        set({
          lines: get().lines.filter((line) => line.storeId !== vendorId),
          summaries: rest,
        })
      },

      addItem(storeId, storeName, item, variant, qty = 1) {
        const resolved = resolveOwnedVariant(item, variant)
        const { itemId, name, price, listPrice } = buildCartLineSnapshot(item, resolved)
        const nextQty = Math.max(1, qty)
        const next = upsertLine(get().lines, {
          itemId,
          storeId,
          storeName,
          name,
          price,
          qty: nextQty,
          lineTotal: price * nextQty,
          listPrice,
          productId: item.id,
          skuId: resolved.id === 'default' ? undefined : resolved.id,
        })
        set({
          lines: next,
          summaries: putSummary(next, get().summaries ?? {}, storeId),
        })
      },

      addPendingLine(pending) {
        const nextQty = Math.max(1, pending.qty)
        const next = upsertLine(get().lines, {
          itemId: variantCartId(pending.productId, pending.skuId),
          storeId: pending.vendorId,
          storeName: pending.storeName,
          name: variantLineName(pending.name, pending.label),
          price: pending.price,
          qty: nextQty,
          lineTotal: pending.price * nextQty,
          productId: pending.productId,
          skuId: pending.skuId,
        })
        set({
          lines: next,
          summaries: putSummary(next, get().summaries ?? {}, pending.vendorId),
        })
      },

      removeItem(itemId) {
        const target = get().lines.find((line) =>
          Boolean(findVendorCartLine([line], line.storeId, itemId)),
        )
        if (!target) return
        const next = get().lines.filter((line) => line !== target)
        set({
          lines: next,
          summaries: putSummary(next, get().summaries ?? {}, target.storeId),
        })
      },

      setQty(itemId, qty) {
        const line = get().lines.find((entry) =>
          Boolean(findVendorCartLine([entry], entry.storeId, itemId)),
        )
        if (!line) return
        if (qty <= 0) {
          get().removeItem(line.itemId)
          return
        }
        const next = get().lines.map((entry) =>
          entry.itemId === line.itemId && entry.storeId === line.storeId
            ? { ...entry, qty, lineTotal: entry.price * qty }
            : entry,
        )
        set({
          lines: next,
          summaries: putSummary(next, get().summaries ?? {}, line.storeId),
        })
      },

      clear() {
        set({ lines: [], summaries: {} })
      },

      itemCount(storeId) {
        if (storeId) {
          const summary = get().summaries?.[storeId]
          if (summary) return summary.totalQuantity
          return get()
            .lines.filter((line) => line.storeId === storeId)
            .reduce((sum, line) => sum + line.qty, 0)
        }
        const summaries = Object.values(get().summaries ?? {})
        if (summaries.length > 0) {
          return summaries.reduce((sum, entry) => sum + entry.totalQuantity, 0)
        }
        return get().lines.reduce((sum, line) => sum + line.qty, 0)
      },

      subtotal(storeId) {
        if (storeId) {
          const summary = get().summaries?.[storeId]
          if (summary) return summary.grandTotal
          return summaryFromLines(
            get().lines.filter((line) => line.storeId === storeId),
          ).grandTotal
        }
        const summaries = Object.values(get().summaries ?? {})
        if (summaries.length > 0) {
          return summaries.reduce((sum, entry) => sum + entry.grandTotal, 0)
        }
        return summaryFromLines(get().lines).grandTotal
      },
    }),
    {
      name: CART_STORAGE_KEY,
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<CartState>
        return {
          ...current,
          ...raw,
          lines: Array.isArray(raw.lines) ? raw.lines : current.lines,
          summaries:
            raw.summaries && typeof raw.summaries === 'object' ? raw.summaries : {},
        }
      },
    },
  ),
)
