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
 * Written against the **price record**, not the SKU: the SKU endpoint carries no price
 * field, and `PUT /v1/sku/price/{price_id}` is vendor-callable and verified working. Note
 * the identifiers differ — the price *read* is keyed by SKU id, the write by price id.
 *
 * The body must be exactly `{sku_id, list_price, sale_price}`. Adding `shipping_price` or
 * `effective_date` — both of which the read returns — is rejected with 400, so the read
 * model cannot be round-tripped.
 *
 * A size with no `priceId` cannot be repriced at all; callers must not offer the control
 * for one.
 *
 * Separately: `PATCH /vendors/{id}/skus/{sku_id}` is **not** broken for every body, as an
 * earlier note here claimed. It fails only when `features` is omitted, and works on both
 * approval states when `features` is echoed back from a fresh read. That is the basis for
 * the rename and availability controls, which are not built here yet.
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
