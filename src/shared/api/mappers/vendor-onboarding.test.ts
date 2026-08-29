import { describe, expect, it } from 'vitest'
import {
  InvalidReferencePayloadError,
  mapCategoryCreateRequest,
  mapCreatedCategory,
  mapCreatedProduct,
  mapMeasurementCatalog,
  mergeMeasurementCatalogDetails,
  mapProductCreateRequest,
  mapVendorContext,
  mapVendorProfile,
  mapVendorSkus,
} from './vendor-onboarding'

describe('measurement catalog detail enrichment', () => {
  it('adds unit_options from the authenticated detail payload omitted by the live list', () => {
    const catalog = mapMeasurementCatalog({
      data: [
        { id: 4, unit: 'Acre,sqft', display_name: 'AREA with Acre,sqft', type: 'AREA' },
        { id: 7, unit: 'Time Slot', display_name: 'SLOT with Time Slot', type: 'SLOT' },
      ],
    })

    expect(mergeMeasurementCatalogDetails(catalog, [
      {
        data: {
          id: 4,
          unit: 'Acre,sqft',
          display_name: 'AREA with Acre,sqft',
          unit_options: [50, 100, 500, 1000],
          type: 'AREA',
        },
      },
      {
        data: {
          id: 7,
          unit: 'Time Slot',
          display_name: 'SLOT with Time Slot',
          unit_options: [],
          type: 'SLOT',
        },
      },
    ])).toEqual([
      { id: 4, type: 'AREA', units: ['Acre', 'sqft'], unitOptions: [50, 100, 500, 1000] },
      { id: 7, type: 'SLOT', units: ['Time Slot'], unitOptions: [] },
    ])
  })
})

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

describe('mapCategoryCreateRequest', () => {
  it('sends business_type_id, name and an optional description', () => {
    expect(mapCategoryCreateRequest({ businessTypeId: 7, name: '  Bakery  ', description: '  Fresh  ' }))
      .toEqual({ business_type_id: 7, name: 'Bakery', description: 'Fresh' })
  })

  it('omits an empty description', () => {
    expect(mapCategoryCreateRequest({ businessTypeId: 7, name: 'Bakery' }))
      .toEqual({ business_type_id: 7, name: 'Bakery', description: undefined })
  })

  it('rejects a blank name or a non-positive business type', () => {
    expect(() => mapCategoryCreateRequest({ businessTypeId: 7, name: '  ' })).toThrow(InvalidReferencePayloadError)
    expect(() => mapCategoryCreateRequest({ businessTypeId: 0, name: 'Bakery' })).toThrow(InvalidReferencePayloadError)
  })
})

describe('mapProductCreateRequest', () => {
  it('sends name, measurement_unit_id and a description that defaults to the name', () => {
    expect(mapProductCreateRequest({ name: '  Sourdough  ', measurementUnitId: 3 }))
      .toEqual({ name: 'Sourdough', measurement_unit_id: 3, description: 'Sourdough' })
  })

  it('keeps an explicit description', () => {
    expect(mapProductCreateRequest({ name: 'Sourdough', measurementUnitId: 3, description: 'Crusty' }))
      .toEqual({ name: 'Sourdough', measurement_unit_id: 3, description: 'Crusty' })
  })

  it('rejects a name shorter than three characters or a missing unit', () => {
    expect(() => mapProductCreateRequest({ name: 'ab', measurementUnitId: 3 })).toThrow(InvalidReferencePayloadError)
    expect(() => mapProductCreateRequest({ name: 'Sourdough', measurementUnitId: 0 })).toThrow(InvalidReferencePayloadError)
  })
})

describe('created-id readers', () => {
  it('read the positive id out of the envelope data object', () => {
    expect(mapCreatedCategory({ data: { id: 5001, name: 'Bakery' } })).toBe(5001)
    expect(mapCreatedProduct({ data: { id: 6001 } })).toBe(6001)
  })

  it('tolerate a bare numeric data payload', () => {
    expect(mapCreatedCategory({ data: 5001 })).toBe(5001)
  })

  it('reject a response with no usable id', () => {
    expect(() => mapCreatedCategory({ data: {} })).toThrow(InvalidReferencePayloadError)
    expect(() => mapCreatedProduct({ data: { id: -1 } })).toThrow(InvalidReferencePayloadError)
    expect(() => mapCreatedCategory(null)).toThrow(InvalidReferencePayloadError)
  })
})
