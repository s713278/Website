import { useEffect, useState } from 'react'
import {
  getDefaultVariant,
  getProductVariants,
  hasMultipleVariants,
} from '@/modules/storefront/lib/product-variants'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product } from '@/modules/storefront/types'

function variantSignature(product: Product) {
  const variants = product.variants
  if (!variants?.length) return `${product.id}|${product.price}`
  return `${product.id}|${product.defaultVariantId ?? ''}|${variants.map((v) => v.id).join(',')}`
}

function resolveCartSkuId(storeId: string | undefined, product: Product): string | null {
  if (!storeId) return null
  const variants = getProductVariants(product)
  const line = useCartStore
    .getState()
    .lines.find(
      (entry) =>
        entry.storeId === storeId &&
        entry.qty > 0 &&
        (entry.productId === product.id ||
          variants.some((variant) => variant.id === entry.skuId || variant.id === entry.itemId)),
    )
  if (!line) return null
  const skuId = line.skuId ?? (line.itemId.includes(':') ? line.itemId.split(':')[1]! : line.itemId)
  return variants.some((variant) => variant.id === skuId) ? skuId : null
}

/**
 * Selected pack size for product card and PDP.
 * If this product is already in the cart, keep that variant selected (not catalog default).
 */
export function useSelectedVariant(product: Product, storeId?: string) {
  const variants = getProductVariants(product)
  const catalogDefaultId = getDefaultVariant(product).id
  const signature = variantSignature(product)

  const cartSkuId = useCartStore((s) => {
    if (!storeId) return null
    const line = s.lines.find(
      (entry) =>
        entry.storeId === storeId &&
        entry.qty > 0 &&
        (entry.productId === product.id ||
          (product.variants?.some(
            (variant) => variant.id === entry.skuId || variant.id === entry.itemId,
          ) ??
            false) ||
          entry.itemId === product.id ||
          entry.skuId === product.defaultVariantId),
    )
    if (!line) return null
    return line.skuId ?? (line.itemId.includes(':') ? line.itemId.split(':')[1]! : line.itemId)
  })

  const [selectedId, setSelectedId] = useState(
    () => resolveCartSkuId(storeId, product) ?? catalogDefaultId,
  )

  useEffect(() => {
    const list = getProductVariants(product)
    setSelectedId((prev) => {
      if (cartSkuId && list.some((variant) => variant.id === cartSkuId)) return cartSkuId
      if (list.some((variant) => variant.id === prev)) return prev
      return catalogDefaultId
    })
  }, [cartSkuId, signature, catalogDefaultId, product])

  const selected =
    variants.find((variant) => variant.id === selectedId) ?? getDefaultVariant(product)

  return {
    variants,
    selected,
    selectedId: selected.id,
    setSelectedId,
    multi: hasMultipleVariants(product),
  }
}
