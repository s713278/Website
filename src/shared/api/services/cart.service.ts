import { apiDelete, apiGet, apiPost, apiPut, unwrapData } from '../client'
import { assertApiSuccess } from '../errors'
import { emptyCartSnapshot, mapCartPayload, type CartSnapshot } from '../mappers/cart'
import { isLiveApi } from '../mode'

function asSkuId(skuId: string | number): number {
  const n = typeof skuId === 'number' ? skuId : Number(skuId)
  if (!Number.isFinite(n)) throw new Error(`Invalid sku_id: ${skuId}`)
  return n
}

/** Vendor-scoped cart HTTP. Demo → empty snapshots; Zustand owns demo cart. */
export const cartService = {
  async get(vendorId: string | number, storeName = ''): Promise<CartSnapshot> {
    if (!isLiveApi()) return emptyCartSnapshot(String(vendorId), storeName)

    const path = `/v1/vendors/${vendorId}/cart`
    const res = assertApiSuccess(await apiGet(path), path)
    return mapCartPayload(unwrapData(res), storeName)
  },

  async addItem(
    vendorId: string | number,
    input: { skuId: string | number; quantity: number },
    storeName = '',
  ): Promise<CartSnapshot> {
    if (!isLiveApi()) return emptyCartSnapshot(String(vendorId), storeName)

    const path = `/v1/vendors/${vendorId}/cart/items`
    const res = assertApiSuccess(
      await apiPost(path, {
        sku_id: asSkuId(input.skuId),
        quantity: Math.max(1, Math.floor(input.quantity)),
      }),
      path,
    )
    return mapCartPayload(unwrapData(res), storeName)
  },

  async setItemQty(
    vendorId: string | number,
    cartItemId: string | number,
    quantity: number,
    storeName = '',
  ): Promise<CartSnapshot> {
    if (!isLiveApi()) return emptyCartSnapshot(String(vendorId), storeName)

    const path = `/v1/vendors/${vendorId}/cart/items/${cartItemId}`
    const res = assertApiSuccess(
      await apiPut(path, { quantity: Math.max(1, Math.floor(quantity)) }),
      path,
    )
    return mapCartPayload(unwrapData(res), storeName)
  },

  async removeItem(vendorId: string | number, cartItemId: string | number): Promise<void> {
    if (!isLiveApi()) return

    const path = `/v1/vendors/${vendorId}/cart/items/${cartItemId}`
    assertApiSuccess(await apiDelete(path), path)
  },

  /** Clears this vendor's cart only. */
  async clear(vendorId: string | number): Promise<void> {
    if (!isLiveApi()) return

    const path = `/v1/vendors/${vendorId}/cart`
    assertApiSuccess(await apiDelete(path), path)
  },
}
