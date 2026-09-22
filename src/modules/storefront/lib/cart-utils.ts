import {
  findVariantForCartLine,
  getProductVariants,
  variantCartId,
  variantLineName,
} from '@/modules/storefront/lib/product-variants'
import type { CartLine, CartSummary, Product } from '@/modules/storefront/types'

export function cartLineProductId(itemId: string) {
  return itemId.includes(':') ? itemId.split(':')[0]! : itemId
}

/** Resolve catalog product for a cart line (by productId, itemId, or skuId). */
export function findProductForCartLine(products: Product[], line: CartLine | string) {
  if (typeof line === 'string') {
    const productId = cartLineProductId(line)
    return products.find((product) => product.id === productId)
  }

  if (line.productId) {
    const byProduct = products.find((product) => product.id === line.productId)
    if (byProduct) return byProduct
  }

  const fromItem = products.find((product) => product.id === cartLineProductId(line.itemId))
  if (fromItem) return fromItem

  const skuId = line.skuId ?? (line.itemId.includes(':') ? line.itemId.split(':')[1] : line.itemId)
  if (!skuId) return undefined

  return products.find(
    (product) =>
      product.defaultVariantId === skuId ||
      getProductVariants(product).some((variant) => variant.id === skuId),
  )
}

export function parseLineUnit(name: string) {
  const match = name.match(/\(([^)]+)\)$/)
  return match?.[1] ?? ''
}

/** Unit price from cart API (`unit_price`). */
export function lineUnitPrice(line: CartLine): number {
  return line.price
}

/** Line amount from cart API (`line_total`), with qty×unit fallback. */
export function lineAmount(line: CartLine): number {
  return line.lineTotal ?? line.price * line.qty
}

export function storeCartLines(lines: CartLine[], storeId: string) {
  return lines.filter((line) => line.storeId === storeId)
}

/** Map API `cart_summary` into the checkout / price-details rows. */
export function priceDetailsFromSummary(summary: CartSummary) {
  return {
    subtotal: summary.itemsTotal,
    delivery: summary.deliveryCharges,
    discount: summary.discount,
    service: summary.serviceCharge,
    packaging: 0,
    total: summary.grandTotal,
    itemCount: summary.totalQuantity,
    lineCount: summary.itemsCount,
  }
}

/**
 * Prefer storefront product_name (+ size) over cart API sku_name.
 * Backend sku_name can disagree with the product card the customer tapped.
 */
export function enrichCartLinesWithCatalog(
  lines: CartLine[],
  products: Product[] = [],
  previousLines: CartLine[] = [],
): CartLine[] {
  return lines.map((line) => {
    const skuId = line.skuId ?? line.itemId
    const prev =
      previousLines.find(
        (entry) =>
          entry.skuId === skuId ||
          entry.itemId === line.itemId ||
          entry.itemId === skuId ||
          (entry.cartItemId && entry.cartItemId === line.cartItemId),
      ) ?? null

    const product =
      findProductForCartLine(products, {
        ...line,
        productId: line.productId ?? prev?.productId,
        skuId,
      }) ?? null

    if (product) {
      const variant =
        getProductVariants(product).find((entry) => entry.id === skuId) ??
        findVariantForCartLine(product, prev?.itemId ?? line.itemId)
      return {
        ...line,
        productId: product.id,
        skuId,
        itemId: variant ? variantCartId(product.id, variant.id) : variantCartId(product.id, skuId),
        name: variantLineName(product.name, variant?.unit ?? ''),
        // Keep API unit_price / line_total — do not reprice from catalog
        price: line.price,
        lineTotal: line.lineTotal,
        imageUrl: product.imageUrl || line.imageUrl || prev?.imageUrl,
      }
    }

    if (prev?.name) {
      return {
        ...line,
        productId: prev.productId ?? line.productId,
        skuId,
        itemId: prev.itemId.includes(':') ? prev.itemId : line.itemId,
        name: prev.name,
        imageUrl: line.imageUrl || prev.imageUrl,
      }
    }

    return { ...line, skuId, imageUrl: line.imageUrl || prev?.imageUrl }
  })
}
