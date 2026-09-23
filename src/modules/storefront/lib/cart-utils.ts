import { cartLineSkuId } from '@/modules/storefront/lib/cart-line-match'
import {
  getProductVariants,
  parseCartLineId,
  productHasSku,
  variantCartId,
  variantLineName,
} from '@/modules/storefront/lib/product-variants'
import type { CartLine, CartSummary, Product } from '@/modules/storefront/types'

export { cartLineProductId } from '@/modules/storefront/lib/product-variants'

/** Resolve catalog product for a cart line (by productId, itemId, or skuId). */
/** SKUs of this product that already have qty in the vendor cart. */
export function cartSkuIdsForProduct(
  lines: CartLine[],
  storeId: string,
  product: Product,
): string[] {
  const variants = getProductVariants(product)
  const variantIds = new Set(variants.map((variant) => variant.id))
  const skuIds: string[] = []

  for (const entry of lines) {
    if (entry.storeId !== storeId || entry.qty <= 0) continue
    const skuId = entry.skuId || undefined
    const belongsToProduct =
      entry.productId === product.id ||
      Boolean(skuId && variantIds.has(skuId)) ||
      (variants.length === 1 &&
        (entry.itemId === product.id ||
          entry.itemId === variantCartId(product.id, variants[0]!.id)))
    if (!belongsToProduct) continue

    const resolved =
      skuId && variantIds.has(skuId) ? skuId : variants.length === 1 ? variants[0]!.id : null
    if (resolved && !skuIds.includes(resolved)) skuIds.push(resolved)
  }

  return skuIds
}

function productOwnsSku(product: Product, skuId: string): boolean {
  return productHasSku(product, skuId)
}

export function findProductForCartLine(products: Product[], line: CartLine | string) {
  if (typeof line === 'string') {
    const parsed = parseCartLineId(line)
    if (parsed.composite) {
      return products.find((product) => productOwnsSku(product, parsed.skuId))
    }
    return products.find((product) => product.id === line && productOwnsSku(product, line))
  }

  const skuId = cartLineSkuId(line)
  if (skuId) {
    const bySku = products.find((product) => productOwnsSku(product, skuId))
    if (bySku) return bySku
  }

  if (line.productId && skuId) {
    const byProduct = products.find((product) => product.id === line.productId)
    if (byProduct && productOwnsSku(byProduct, skuId)) return byProduct
  }

  return undefined
}

export function parseLineUnit(name: string) {
  const paren = name.match(/\(([^)]+)\)$/)
  if (paren?.[1]) return paren[1].trim()
  const dash = name.match(/[-–—]\s*(\d[\d.,]*\s*[a-zA-Z]+)\s*$/)
  return dash?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
}

export function displayLineName(name: string) {
  return name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s*[-–—]\s*\d[\d.,]*\s*[a-zA-Z]+\s*$/, '')
    .trim()
}

function normalizeSize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function pickCartLineName(input: {
  apiName: string
  catalogName: string
  catalogUnit: string
  siblingUnits: string[]
  previousName?: string
  hintName?: string
}) {
  if (input.hintName) return input.hintName

  const apiSize = normalizeSize(parseLineUnit(input.apiName))
  const catalogSize = normalizeSize(parseLineUnit(input.catalogName) || input.catalogUnit)
  const sameUnitCount = input.siblingUnits.filter(
    (unit) => normalizeSize(unit) === catalogSize,
  ).length
  const catalogUnitIsAmbiguous = Boolean(catalogSize) && sameUnitCount > 1

  // This SKU's catalog row wins. A leftover local name (Garlic on a Biryani line)
  // must not survive logout → login just because the size text differs.
  if (apiSize && catalogSize && apiSize !== catalogSize) return input.apiName
  if (apiSize && catalogUnitIsAmbiguous) return input.apiName
  if (input.catalogUnit) return input.catalogName
  if (input.apiName && input.apiName !== 'Item') return input.apiName
  return input.previousName || input.catalogName
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
 * Keep the tapped size when catalog units collide or the API name is more specific.
 */
export function enrichCartLinesWithCatalog(
  lines: CartLine[],
  products: Product[] = [],
  previousLines: CartLine[] = [],
  skuLabels: Record<string, string> = {},
): CartLine[] {
  return lines.map((line) => {
    const skuId = cartLineSkuId(line)
    const prev =
      previousLines.find((entry) => {
        const entrySku = cartLineSkuId(entry)
        return Boolean(entrySku && entrySku === skuId)
      }) ?? null
    const hintName = skuLabels[skuId]

    const product =
      findProductForCartLine(products, {
        ...line,
        productId: line.productId ?? prev?.productId,
        skuId,
      }) ?? null

    if (product) {
      const variants = getProductVariants(product)
      const variant = variants.find((entry) => entry.id === skuId)
      if (!variant) {
        return {
          ...line,
          skuId,
          productId: product.id,
          name: hintName || prev?.name || line.name,
          imageUrl: line.imageUrl || prev?.imageUrl || product.imageUrl,
        }
      }
      return {
        ...line,
        productId: product.id,
        skuId,
        itemId: variantCartId(product.id, variant.id),
        name: pickCartLineName({
          apiName: line.name,
          catalogName: variantLineName(product.name, variant.unit),
          catalogUnit: variant.unit,
          siblingUnits: variants.map((entry) => entry.unit),
          previousName: prev?.name,
          hintName,
        }),
        // Keep API unit_price / line_total — do not reprice from catalog
        price: line.price,
        lineTotal: line.lineTotal,
        imageUrl: product.imageUrl || line.imageUrl || prev?.imageUrl,
      }
    }

    if (hintName || prev?.name) {
      return {
        ...line,
        productId: prev?.productId ?? line.productId,
        skuId,
        itemId: prev && parseCartLineId(prev.itemId).composite ? prev.itemId : line.itemId,
        name: hintName || prev?.name || line.name,
        imageUrl: line.imageUrl || prev?.imageUrl,
      }
    }

    return { ...line, skuId, imageUrl: line.imageUrl || prev?.imageUrl }
  })
}
