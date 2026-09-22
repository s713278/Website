export function storePath(storeId: string) {
  return `/stores/${storeId}`
}

/** `/stores/273/cart` → `273`. */
export function storeIdFromPath(path: string | undefined): string | null {
  if (!path) return null
  const pathname = path.split('?')[0]
  const match = /^\/stores\/([^/]+)/.exec(pathname)
  return match?.[1] ?? null
}

/** Store home with the product search bar open. */
export function storeSearchPath(storeId: string) {
  return `${storePath(storeId)}?search=1`
}

export function storeProductPath(storeId: string, productId: string, skuId?: string) {
  const base = `${storePath(storeId)}/products/${productId}`
  if (!skuId) return base
  return `${base}?${new URLSearchParams({ sku: skuId })}`
}

export function storeCartPath(storeId: string) {
  return `${storePath(storeId)}/cart`
}

export function storeCheckoutPath(storeId: string) {
  return `${storePath(storeId)}/checkout`
}

export function locationMapPath(
  storeId: string,
  options?: { from?: string; editId?: string },
) {
  const params = new URLSearchParams()
  if (options?.from) params.set('from', options.from)
  if (options?.editId) params.set('edit', options.editId)
  const query = params.toString()
  return `${storePath(storeId)}/location${query ? `?${query}` : ''}`
}

export function storeOrderSuccessPath(storeId: string, orderId: string) {
  return `${storePath(storeId)}/orders/${orderId}/success`
}

