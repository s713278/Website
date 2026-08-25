export function storePath(storeId: string) {
  return `/stores/${storeId}`
}

export function storeProductPath(storeId: string, productId: string) {
  return `${storePath(storeId)}/products/${productId}`
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
