import type { VendorSize } from '@/modules/vendor/types/dashboard'
import { apiGet, apiPut } from '../client'
import { updateDemoSizeByPriceId } from '../fixtures/demo-state'
import { demoVendorSizes } from '../fixtures/vendor-dashboard'
import { mapVendorSizes } from '../mappers/vendor-dashboard'
import { isLiveApi } from '../mode'
import { demoDelay } from './demo-delay'

/**
 * Every size the vendor sells, with the price record behind each.
 *
 * Reads `/products/skus`, not `/products`: the latter answers only
 * `{id, name, category_id, measurement_id, ref_id}` — no price and no size — which is why
 * the previous products page rendered every row at ₹0.
 */
export async function listVendorSizes(vendorId: string | number): Promise<VendorSize[]> {
  if (!isLiveApi()) {
    await demoDelay()
    return mapVendorSizes(demoVendorSizes())
  }
  return mapVendorSizes(await apiGet(`/v1/vendors/${vendorId}/products/skus`))
}

/**
 * Change what a size costs.
 *
 * Written against the **price record**, not the SKU: `PATCH /vendors/{id}/skus/{sku_id}`
 * fails with a JDBC error on every body, and its request schema carries no price field
 * anyway. `PUT /v1/sku/price/{price_id}` is vendor-callable and verified working.
 *
 * A size with no `priceId` therefore cannot be repriced at all; callers must not offer
 * the control for one.
 */
export async function updateSizePrice(
  priceId: string,
  input: { skuId: string; listPrice: number; salePrice: number },
): Promise<void> {
  if (!isLiveApi()) {
    await demoDelay()
    // Demo writes persist, so a price edit is visible on the next demo read.
    if (!updateDemoSizeByPriceId(priceId, { list_price: input.listPrice, sale_price: input.salePrice })) {
      throw new Error('No such price record.')
    }
    return
  }
  await apiPut(`/v1/sku/price/${priceId}`, {
    sku_id: Number(input.skuId),
    list_price: input.listPrice,
    sale_price: input.salePrice,
  })
}

export const vendorProductsService = {
  listSizes: listVendorSizes,
  updatePrice: updateSizePrice,
}
