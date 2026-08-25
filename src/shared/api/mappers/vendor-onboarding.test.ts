import { describe, expect, it } from 'vitest'
import { mapVendorContext, mapVendorProfile, mapVendorSkus } from './vendor-onboarding'

/**
 * These three reads decide whether the wizard thinks a store is finished and whether a
 * resumed SKU survives Step 6. None of them is typed in the OpenAPI document — `data` is
 * a bare object — so the shapes below are the live payloads, and this is the only thing
 * standing between a backend field rename and a silently empty wizard.
 */

describe('mapVendorSkus', () => {
  it('splits sku_size and strips the server name suffix', () => {
    const [sku] = mapVendorSkus({
      data: [{
        vendor_product_id: 900,
        sku_id: 4021,
        sku_name: 'Orange Juice-1 L',
        sku_size: '1 L',
        description: 'Cold pressed',
        is_active: true,
        list_price: 180,
        sale_price: 160,
      }],
    })

    expect(sku).toMatchObject({
      vendorProductId: 900,
      skuId: 4021,
      displayName: 'Orange Juice',
      quantity: 1,
      unit: 'L',
      isActive: true,
      listPrice: 180,
      salePrice: 160,
    })
  })

  it('keeps two sizes of one product distinct after the suffix is stripped', () => {
    const skus = mapVendorSkus({
      data: [
        { vendor_product_id: 900, sku_id: 1, sku_name: 'Milk-1 L', sku_size: '1 L', list_price: 60, sale_price: 55 },
        { vendor_product_id: 900, sku_id: 2, sku_name: 'Milk-500 ml', sku_size: '500 ml', list_price: 35, sale_price: 30 },
      ],
    })

    expect(skus.map((sku) => sku.displayName)).toEqual(['Milk', 'Milk'])
    expect(skus.map((sku) => [sku.quantity, sku.unit])).toEqual([[1, 'L'], [500, 'ml']])
  })

  it('reads the { result: [] } container the API also returns', () => {
    const skus = mapVendorSkus({
      data: { result: [{ vendor_product_id: 900, sku_id: 7, sku_name: 'Tea', sku_size: '250 g' }] },
    })
    expect(skus).toHaveLength(1)
  })

  it('treats a missing is_active as active', () => {
    const [sku] = mapVendorSkus({ data: [{ vendor_product_id: 900, sku_id: 7, sku_name: 'Tea', sku_size: '250 g' }] })
    expect(sku.isActive).toBe(true)
  })
})

describe('mapVendorContext', () => {
  it('reads the status fields the completion decision depends on', () => {
    const context = mapVendorContext({
      data: {
        vendor_id: 91,
        business_name: 'SK Organic Store',
        store_identifier: 'sk-organic-store',
        vendor_status: 'ACTIVE',
        approval_status: 'PENDING',
        role: 'OWNER',
        onboarding: { status: 'IN_PROGRESS', description: 'Step 5 is completed' },
        subscription: { tier: 'SILVER', limits: { max_categories: 10 }, usage: { categories: 2 } },
        eligible_features: ['DASHBOARD', 'CATALOG'],
      },
    })

    expect(context).toMatchObject({
      vendorId: '91',
      storeIdentifier: 'sk-organic-store',
      vendorStatus: 'ACTIVE',
      approvalStatus: 'PENDING',
    })
    expect(context.subscription.limits.maxCategories).toBe(10)
    expect(context.eligibleFeatures).toEqual(['DASHBOARD', 'CATALOG'])
  })
})

describe('mapVendorProfile', () => {
  it('exposes business_type and contact_number, the only source for Steps 3 and 9', () => {
    expect(mapVendorProfile({
      data: {
        business_name: 'SK Organic Store',
        business_type: 'Beverages & Juice Center',
        owner_name: 'Sanjay Kumar',
        contact_person: 'Sanjay Kumar',
        contact_number: '9876543210',
      },
    })).toEqual({
      businessName: 'SK Organic Store',
      businessType: 'Beverages & Juice Center',
      ownerName: 'Sanjay Kumar',
      contactPerson: 'Sanjay Kumar',
      contactNumber: '9876543210',
    })
  })
})
