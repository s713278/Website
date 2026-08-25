import type { Product, ProductVariant } from '@/modules/storefront/types'

const DEFAULT_VARIANT_ID = 'default'

export function getProductVariants(product: Product): ProductVariant[] {
  if (product.variants?.length) return product.variants
  return [
    {
      id: DEFAULT_VARIANT_ID,
      unit: product.unit ?? '',
      price: product.price,
    },
  ]
}

export function getDefaultVariant(product: Product): ProductVariant {
  const variants = getProductVariants(product)
  return variants.reduce((lowest, variant) =>
    variant.price < lowest.price ? variant : lowest,
  )
}

export function resolveVariant(product: Product, variant?: ProductVariant): ProductVariant {
  return variant ?? getDefaultVariant(product)
}

export function hasMultipleVariants(product: Product): boolean {
  return (product.variants?.length ?? 0) > 1
}

export function variantCartId(productId: string, variantId: string): string {
  return variantId === DEFAULT_VARIANT_ID ? productId : `${productId}:${variantId}`
}

export function variantIdFromCartLine(itemId: string): string {
  return itemId.includes(':') ? itemId.split(':')[1]! : DEFAULT_VARIANT_ID
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
  }
}

export function getProductImages(product: Product): string[] {
  if (product.images?.length) return product.images
  if (product.imageUrl) return [product.imageUrl]
  return []
}

/** Per-kg label for weight-based units, e.g. "(₹398 / kg)". */
export function formatPricePerKg(price: number, unit: string): string | null {
  const match = unit.match(/([\d.]+)\s*(g|kg)/i)
  if (!match) return null
  const amount = Number.parseFloat(match[1])
  if (!amount) return null
  const grams = match[2].toLowerCase() === 'kg' ? amount * 1000 : amount
  if (!grams) return null
  const perKg = Math.round((price / grams) * 1000)
  return `(₹${perKg.toLocaleString('en-IN')} / kg)`
}
