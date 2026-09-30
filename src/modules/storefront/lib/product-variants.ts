import type { Product, ProductVariant } from '@/modules/storefront/types'
import { formatCurrency } from '@/shared/lib/utils'

const DEFAULT_VARIANT_ID = 'default'

export function getProductVariants(product: Product): ProductVariant[] {
  if (product.variants?.length) return product.variants
  return [
    {
      id: DEFAULT_VARIANT_ID,
      unit: product.unit ?? '',
      price: product.price,
      onSale: false,
      skuType: 'ITEM',
    },
  ]
}

export function getDefaultVariant(product: Product): ProductVariant {
  const variants = getProductVariants(product)
  if (product.defaultVariantId) {
    const preferred = variants.find((variant) => variant.id === product.defaultVariantId)
    if (preferred) return preferred
  }
  return variants[0]!
}

export function resolveVariant(product: Product, variant?: ProductVariant): ProductVariant {
  return variant ?? getDefaultVariant(product)
}

/** True only when this catalog product lists the SKU. */
export function productHasSku(product: Product, skuId: string): boolean {
  if (!skuId || skuId === DEFAULT_VARIANT_ID) return false
  if (product.variants?.some((variant) => variant.id === skuId)) return true
  return !product.variants?.length && product.defaultVariantId === skuId
}

/**
 * Size to add — must belong to this product.
 * A leftover selected SKU from another card (Amla 1 kg on Mixed Vegetable) is ignored.
 */
export function resolveOwnedVariant(product: Product, variant?: ProductVariant): ProductVariant {
  if (variant?.id && productHasSku(product, variant.id)) {
    return getProductVariants(product).find((entry) => entry.id === variant.id) ?? variant
  }
  return getDefaultVariant(product)
}

/** Real backend sku_id — never a synthetic `default` or a vendor_product_id stand-in. */
export function cartSkuId(product: Product, variant?: ProductVariant): string {
  const resolved = resolveOwnedVariant(product, variant)
  if (resolved.id && resolved.id !== DEFAULT_VARIANT_ID) return resolved.id
  if (product.defaultVariantId && productHasSku(product, product.defaultVariantId)) {
    return product.defaultVariantId
  }
  const firstReal = (product.variants ?? []).find((entry) => entry.id && entry.id !== DEFAULT_VARIANT_ID)
  return firstReal?.id ?? resolved.id
}

export function hasMultipleVariants(product: Product): boolean {
  return (product.variants?.length ?? 0) > 1
}

/** Distinguishes two sizes even when the API repeats the same sku_id. */
export function variantSelectKey(variant: ProductVariant): string {
  return `${variant.id}::${variant.unit}::${variant.price}`
}

export function findVariantBySelection(
  variants: ProductVariant[],
  selectedId: string,
): ProductVariant | undefined {
  return (
    variants.find((variant) => variantSelectKey(variant) === selectedId) ??
    variants.find((variant) => variant.id === selectedId)
  )
}

export function formatVariantLabel(variant: ProductVariant, disambiguate = false): string {
  if (!variant.unit) return formatCurrency(variant.price)
  if (!disambiguate) return variant.unit
  return `${variant.unit} · ${formatCurrency(variant.price)}`
}

/** Units that appear more than once — show price on the label to tell them apart. */
export function duplicateVariantUnits(variants: ProductVariant[]): Set<string> {
  const counts = new Map<string, number>()
  for (const variant of variants) {
    const key = variant.unit || variant.id
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const dupes = new Set<string>()
  for (const [key, count] of counts) {
    if (count > 1) dupes.add(key)
  }
  return dupes
}

export function variantCartId(productId: string, variantId: string): string {
  return variantId === DEFAULT_VARIANT_ID ? productId : `${productId}:${variantId}`
}

/** Split `productId:skuId`. A bare id is the product; sku is `default`. */
export function parseCartLineId(itemId: string): {
  productId: string
  skuId: string
  composite: boolean
} {
  const colon = itemId.indexOf(':')
  if (colon === -1) return { productId: itemId, skuId: DEFAULT_VARIANT_ID, composite: false }
  return {
    productId: itemId.slice(0, colon),
    skuId: itemId.slice(colon + 1),
    composite: true,
  }
}

export function cartLineProductId(itemId: string): string {
  return parseCartLineId(itemId).productId
}

export function variantIdFromCartLine(itemId: string): string {
  return parseCartLineId(itemId).skuId
}

export function findVariantForCartLine(product: Product, itemId: string): ProductVariant | undefined {
  const variantId = variantIdFromCartLine(itemId)
  return getProductVariants(product).find((variant) => variant.id === variantId)
}

export function variantLineName(productName: string, unit: string): string {
  return unit ? `${productName} (${unit})` : productName
}

export function buildCartLineSnapshot(product: Product, variant: ProductVariant) {
  return {
    itemId: variantCartId(product.id, variant.id),
    name: variantLineName(product.name, variant.unit),
    price: variant.price,
    listPrice: variant.listPrice,
  }
}

export function getProductImages(product: Product): string[] {
  if (product.images?.length) return product.images
  if (product.imageUrl) return [product.imageUrl]
  return []
}
