import { useEffect, useRef, useState } from 'react'
import {
  findVariantBySelection,
  getDefaultVariant,
  getProductVariants,
  hasMultipleVariants,
  variantSelectKey,
} from '@/modules/storefront/lib/product-variants'
import type { Product } from '@/modules/storefront/types'

function variantSignature(product: Product) {
  const variants = product.variants
  if (!variants?.length) return `${product.id}|${product.price}`
  return `${product.id}|${product.defaultVariantId ?? ''}|${variants.map((v) => `${v.id}:${v.unit}:${v.price}`).join(',')}`
}

/**
 * Selected pack size for product card and PDP.
 * Starts on the catalog default. Only the size chip changes it — never the cart —
 * so Add posts the SKU the customer highlighted.
 */
export function useSelectedVariant(product: Product, _storeId?: string) {
  const variants = getProductVariants(product)
  const catalogDefault = getDefaultVariant(product)
  const signature = variantSignature(product)

  const [selectedKey, setSelectedKey] = useState(() => variantSelectKey(catalogDefault))
  const productIdRef = useRef(product.id)

  useEffect(() => {
    const list = getProductVariants(product)
    const fallback = variantSelectKey(getDefaultVariant(product))
    if (productIdRef.current !== product.id) {
      productIdRef.current = product.id
      setSelectedKey(fallback)
      return
    }
    setSelectedKey((prev) => {
      if (findVariantBySelection(list, prev)) return prev
      return fallback
    })
  }, [signature, product])

  const selected = findVariantBySelection(variants, selectedKey) ?? getDefaultVariant(product)

  return {
    variants,
    selected,
    selectedId: variantSelectKey(selected),
    setSelectedId: (id: string) => {
      const match = findVariantBySelection(variants, id)
      setSelectedKey(match ? variantSelectKey(match) : id)
    },
    multi: hasMultipleVariants(product),
  }
}
