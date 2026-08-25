import { useEffect, useMemo, useState } from 'react'
import {
  getDefaultVariant,
  getProductVariants,
  hasMultipleVariants,
} from '@/modules/storefront/lib/product-variants'
import type { Product } from '@/modules/storefront/types'

/** Selected pack size for product card and PDP. */
export function useSelectedVariant(product: Product) {
  const variants = useMemo(() => getProductVariants(product), [product])
  const [selectedId, setSelectedId] = useState(() => getDefaultVariant(product).id)

  useEffect(() => {
    setSelectedId(getDefaultVariant(product).id)
  }, [product])

  const selected =
    variants.find((variant) => variant.id === selectedId) ?? getDefaultVariant(product)

  return {
    variants,
    selected,
    selectedId,
    setSelectedId,
    multi: hasMultipleVariants(product),
  }
}
