import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine, StoreProduct, StoreSku } from '@/features/storefront/types';

type CartState = {
  lines: CartLine[];
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addItem: (product: StoreProduct, sku: StoreSku, qty?: number) => void;
  setQty: (skuId: string, qty: number) => void;
  removeItem: (skuId: string) => void;
  clear: () => void;
  setRemoteItemId: (skuId: string, remoteItemId: string | number) => void;
  replaceLines: (lines: CartLine[]) => void;
  count: () => number;
  subtotal: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      drawerOpen: false,
      setDrawerOpen: (open) => set({ drawerOpen: open }),
      addItem: (product, sku, qty = 1) => {
        if (!sku.active || qty <= 0) return;
        set((state) => {
          const existing = state.lines.find((l) => l.skuId === sku.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.skuId === sku.id ? { ...l, qty: l.qty + qty } : l,
              ),
            };
          }
          const line: CartLine = {
            productId: product.id,
            skuId: sku.id,
            name: product.name,
            label: sku.label,
            price: sku.price,
            image: product.image,
            icon: product.icon,
            color: product.color,
            qty,
          };
          return { lines: [...state.lines, line] };
        });
      },
      setQty: (skuId, qty) => {
        set((state) => {
          if (qty <= 0) {
            return { lines: state.lines.filter((l) => l.skuId !== skuId) };
          }
          return {
            lines: state.lines.map((l) => (l.skuId === skuId ? { ...l, qty } : l)),
          };
        });
      },
      removeItem: (skuId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.skuId !== skuId) })),
      clear: () => set({ lines: [] }),
      setRemoteItemId: (skuId, remoteItemId) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.skuId === skuId ? { ...l, remoteItemId } : l)),
        })),
      replaceLines: (lines) => set({ lines }),
      count: () => get().lines.reduce((n, l) => n + l.qty, 0),
      subtotal: () => get().lines.reduce((n, l) => n + l.price * l.qty, 0),
    }),
    {
      name: 'mithra_web_store_cart',
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);
