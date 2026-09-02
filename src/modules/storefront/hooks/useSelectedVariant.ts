import { useEffect, useState } from 'react'
import {
  getDefaultVariant,
  getProductVariants,
  hasMultipleVariants,
} from '@/modules/storefront/lib/product-variants'
import type { Product } from '@/modules/storefront/types'

function variantSignature(product: Product) {
  const variants = product.variants
  if (!variants?.length) return `${product.id}|${product.price}`
  return `${product.id}|${product.defaultVariantId ?? ''}|${variants.map((v) => v.id).join(',')}`
}

/** Selected pack size for product card and PDP. */
export function useSelectedVariant(product: Product) {
  const variants = getProductVariants(product)
  const defaultId = getDefaultVariant(product).id
  const signature = variantSignature(product)
  const [selectedId, setSelectedId] = useState(defaultId)

  useEffect(() => {
    setSelectedId(defaultId)
  }, [signature, defaultId])

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
