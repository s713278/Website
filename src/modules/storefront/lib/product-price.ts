import type { Product } from '@/modules/storefront/types'
import { formatCurrency } from '@/shared/lib/utils'

function priceBounds(product: Product): { min: number; max: number } {
  if (product.variants?.length) {
    const prices = product.variants.map((variant) => variant.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }
  const min = product.minPrice ?? product.startingAt ?? product.price
  const max = product.maxPrice ?? product.minPrice ?? product.startingAt ?? product.price
  return { min, max }
}

/** True when the card should show a min–max range (not a single amount). */
export function hasDistinctPriceRange(product: Product): boolean {
  const { min, max } = priceBounds(product)
  return min !== max
}

/** Card price: single amount, or min – max when the API sends a range. */
export function formatProductPriceRange(product: Product): string {
  const { min, max } = priceBounds(product)
  if (min === max) return formatCurrency(min)
  return `${formatCurrency(min)} – ${formatCurrency(max)}`
}
