import type { VendorSize } from '@/modules/vendor/types/dashboard'

/**
 * A size's `sku_name` reads "Organic Rice — 5 kg": the product plus that size. The product
 * heading wants only the product, since every size is listed beneath it.
 */
function productName(size: VendorSize): string {
  const suffix = size.size?.trim()
  if (!suffix || !size.name.toLowerCase().endsWith(suffix.toLowerCase())) return size.name
  const base = size.name.slice(0, size.name.length - suffix.length).replace(/[\s\-–—:,(]+$/, '')
  return base || size.name
}

/** Sizes arrive flat; a vendor thinks in products, so they are grouped back up. */
export function groupByProduct(sizes: VendorSize[]) {
  const groups = new Map<string, { name: string; sizes: VendorSize[] }>()
  for (const size of sizes) {
    const key = size.productId ?? `sku-${size.skuId}`
    const group = groups.get(key) ?? { name: productName(size), sizes: [] }
    group.sizes.push(size)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([id, group]) => ({ id, ...group }))
}
