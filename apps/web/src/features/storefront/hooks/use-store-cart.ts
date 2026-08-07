import { useCallback } from 'react';
import { cartService } from '@mithra/api-client';
import { env } from '@/shared/lib/env';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useCartStore } from '@/features/storefront/store/cart-store';
import type { StoreProduct, StoreSku } from '@/features/storefront/types';
import { formatMoney } from '@/features/storefront/lib/theme';

async function syncAdd(vendorId: string, skuId: string, qty: number) {
  try {
    await cartService.upsertItem(vendorId, { sku_id: Number(skuId) || skuId, quantity: qty });
  } catch {
    /* local cart remains source of truth offline */
  }
}

async function syncQty(
  vendorId: string,
  remoteItemId: string | number | undefined,
  skuId: string,
  qty: number,
) {
  try {
    if (remoteItemId != null) {
      if (qty <= 0) await cartService.removeItem(vendorId, remoteItemId);
      else await cartService.updateItemQty(vendorId, remoteItemId, { quantity: qty });
      return;
    }
    if (qty > 0) {
      await cartService.upsertItem(vendorId, { sku_id: Number(skuId) || skuId, quantity: qty });
    }
  } catch {
    /* ignore remote failures */
  }
}

export function useStoreCart(vendorId?: string | null) {
  const lines = useCartStore((s) => s.lines);
  const drawerOpen = useCartStore((s) => s.drawerOpen);
  const setDrawerOpen = useCartStore((s) => s.setDrawerOpen);
  const addItemLocal = useCartStore((s) => s.addItem);
  const setQtyLocal = useCartStore((s) => s.setQty);
  const removeItemLocal = useCartStore((s) => s.removeItem);
  const clearLocal = useCartStore((s) => s.clear);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const canSync = Boolean(env.useApi && vendorId && isAuthenticated);

  const addItem = useCallback(
    (product: StoreProduct, sku: StoreSku, qty = 1) => {
      addItemLocal(product, sku, qty);
      if (canSync && vendorId) void syncAdd(vendorId, sku.id, qty);
      setDrawerOpen(true);
    },
    [addItemLocal, canSync, vendorId, setDrawerOpen],
  );

  const setQty = useCallback(
    (skuId: string, qty: number) => {
      const line = useCartStore.getState().lines.find((l) => l.skuId === skuId);
      setQtyLocal(skuId, qty);
      if (canSync && vendorId) void syncQty(vendorId, line?.remoteItemId, skuId, qty);
    },
    [setQtyLocal, canSync, vendorId],
  );

  const removeItem = useCallback(
    (skuId: string) => {
      const line = useCartStore.getState().lines.find((l) => l.skuId === skuId);
      removeItemLocal(skuId);
      if (canSync && vendorId && line?.remoteItemId != null) {
        void cartService.removeItem(vendorId, line.remoteItemId).catch(() => undefined);
      }
    },
    [removeItemLocal, canSync, vendorId],
  );

  const clear = useCallback(() => {
    clearLocal();
    if (canSync && vendorId) void cartService.clear(vendorId).catch(() => undefined);
  }, [clearLocal, canSync, vendorId]);

  return {
    lines,
    drawerOpen,
    setDrawerOpen,
    addItem,
    setQty,
    removeItem,
    clear,
    count,
    subtotal,
    subtotalLabel: formatMoney(subtotal),
    canSync,
  };
}
