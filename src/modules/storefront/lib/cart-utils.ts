import {
  findVariantForCartLine,
} from '@/modules/storefront/lib/product-variants'
import type { CartLine, Product } from '@/modules/storefront/types'

export function cartLineProductId(itemId: string) {
  return itemId.includes(':') ? itemId.split(':')[0]! : itemId
}

export function findProductForCartLine(products: Product[], itemId: string) {
  return products.find((product) => product.id === cartLineProductId(itemId))
}

export function parseLineUnit(name: string) {
  const match = name.match(/\(([^)]+)\)$/)
  return match?.[1] ?? ''
}

/** Authoritative unit price — catalog variant when available, else stored snapshot. */
export function resolveLinePrice(product: Product | undefined, line: CartLine): number {
  if (!product) return line.price
  return findVariantForCartLine(product, line.itemId)?.price ?? line.price
}

export function storeCartLines(lines: CartLine[], storeId: string) {
  return lines.filter((line) => line.storeId === storeId)
}

export function storeCartSubtotal(lines: CartLine[], products: Product[], storeId: string) {
  return storeCartLines(lines, storeId).reduce((sum, line) => {
    const product = findProductForCartLine(products, line.itemId)
    return sum + resolveLinePrice(product, line) * line.qty
  }, 0)
}

export function cartTotals(subtotal: number, hasItems: boolean) {
  if (!hasItems) {
    return { subtotal: 0, delivery: 0, packaging: 0, total: 0 }
  }
  return {
    subtotal,
    delivery: 0,
    packaging: 0,
    total: subtotal,
  }
}
