export function storePath(storeId: string) {
  return `/stores/${storeId}`
}

/** Contact us page — same pattern as Track Order (`/orders`). */
export function storeContactPath(storeId: string) {
  return `${storePath(storeId)}/contact`
}

export function isStoreContactPath(path: string | undefined): boolean {
  if (!path) return false
  return /^\/stores\/[^/]+\/contact\/?$/.test(path.split('?')[0] ?? '')
}

/** Shop-header underline: Contact us / Track Order win; Home only on the shop itself. */
export function storefrontActiveNav(path: string | undefined, fallback = 'home'): string {
  if (isStoreContactPath(path)) return 'contact'
  if (isStoreOrdersPath(path)) return 'orders'
  if (isStoreHomePath(path)) return fallback
  return ''
}

/** Shop catalog home — `/stores/273`. Search query still counts as home. */
export function isStoreHomePath(path: string | undefined): boolean {
  if (!path) return false
  return /^\/stores\/[^/]+\/?$/.test(path.split('?')[0] ?? '')
}

/** `/stores/273/cart` → `273`. */
export function storeIdFromPath(path: string | undefined): string | null {
  if (!path) return null
  const pathname = path.split('?')[0]
  const match = /^\/stores\/([^/]+)/.exec(pathname)
  return match?.[1] ?? null
}

/**
 * Parent for the inner-page Back control (shared link, refresh).
 * Nested flows go one step up; everything else to the shop.
 */
export function storeBackFallback(path: string | undefined): string | null {
  const shopId = storeIdFromPath(path)
  if (!shopId || isStoreHomePath(path)) return null

  const pathname = (path ?? '').split('?')[0] ?? ''
  const query = (path ?? '').split('?')[1] ?? ''

  if (/\/checkout\/?$/.test(pathname)) return storeCartPath(shopId)

  const success = /^\/stores\/[^/]+\/orders\/([^/]+)\/success\/?$/.exec(pathname)
  if (success?.[1]) return storeOrderPath(shopId, success[1])

  if (/^\/stores\/[^/]+\/orders\/[^/]+\/?$/.test(pathname)) return storeOrdersPath(shopId)

  if (/\/location\/?$/.test(pathname)) {
    const from = new URLSearchParams(query).get('from')
    if (from && storeIdFromPath(from) === shopId) return from
  }

  return storePath(shopId)
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

export function storeOrdersPath(storeId: string) {
  return `${storePath(storeId)}/orders`
}

/** History, detail, and success under `/stores/:id/orders`. */
export function isStoreOrdersPath(path: string | undefined): boolean {
  if (!path) return false
  return /^\/stores\/[^/]+\/orders(?:\/|$)/.test(path.split('?')[0] ?? '')
}

export function storeOrderPath(storeId: string, orderId: string) {
  return `${storeOrdersPath(storeId)}/${orderId}`
}

export function storeOrderSuccessPath(storeId: string, orderId: string) {
  return `${storeOrderPath(storeId, orderId)}/success`
}

