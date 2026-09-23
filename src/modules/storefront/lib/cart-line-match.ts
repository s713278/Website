import { parseCartLineId, variantCartId } from '@/modules/storefront/lib/product-variants'
import type { CartLine } from '@/modules/storefront/types'

export function cartLineSkuId(line: Pick<CartLine, 'skuId' | 'itemId'>): string {
  if (line.skuId) return line.skuId
  const parsed = parseCartLineId(line.itemId)
  // Bare product id is not sku `default` — keep the id so two single-SKU
  // products do not look like the same line.
  return parsed.composite ? parsed.skuId : line.itemId
}

export function isSameCartSku(
  left: Pick<CartLine, 'storeId' | 'itemId' | 'skuId' | 'productId'>,
  right: Pick<CartLine, 'storeId' | 'itemId' | 'skuId' | 'productId'>,
): boolean {
  if (left.storeId !== right.storeId) return false
  const leftSku = cartLineSkuId(left)
  const rightSku = cartLineSkuId(right)
  if (leftSku && rightSku) {
    if (leftSku !== rightSku) return false
    if (left.productId && right.productId) return left.productId === right.productId
    return true
  }
  return left.itemId === right.itemId
}

export function findVendorCartLine(
  lines: CartLine[],
  vendorId: string,
  itemId: string,
): CartLine | undefined {
  const parsed = parseCartLineId(itemId)

  return (
    lines.find(
      (line) =>
        line.storeId === vendorId &&
        (line.itemId === itemId || line.cartItemId === itemId),
    ) ??
    lines.find((line) => {
      if (line.storeId !== vendorId) return false
      if (parsed.composite) {
        if (cartLineSkuId(line) !== parsed.skuId) return false
        if (line.productId && parsed.productId) return line.productId === parsed.productId
        return true
      }
      return line.skuId === itemId
    })
  )
}

export function lineMatchesVariant(
  line: CartLine,
  storeId: string,
  productId: string,
  variantId: string,
): boolean {
  if (line.storeId !== storeId) return false
  const lineId = variantCartId(productId, variantId)
  if (line.itemId === lineId) return true
  if (line.skuId === variantId && (!line.productId || line.productId === productId)) return true
  return variantId === 'default' && line.itemId === productId && !line.skuId
}
