import type { VendorSize } from '@/modules/vendor/types/dashboard'

/** Sizes arrive flat; a vendor thinks in products, so they are grouped back up. */
export function groupByProduct(sizes: VendorSize[]) {
  const groups = new Map<string, { name: string; sizes: VendorSize[] }>()
  for (const size of sizes) {
    const key = size.productId ?? `sku-${size.skuId}`
    const group = groups.get(key) ?? { name: size.name, sizes: [] }
    group.sizes.push(size)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([id, group]) => ({ id, ...group }))
}
