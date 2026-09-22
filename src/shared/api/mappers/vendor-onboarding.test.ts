import { describe, expect, it } from 'vitest'
import {
  InvalidReferencePayloadError,
  mapCategoryCreateRequest,
  mapCategoryPage,
  mapCheckoutOptionsRequest,
  mapCheckoutOptionsResponse,
  mapCreatedCategory,
  mapCreatedProduct,
  mapMeasurementCatalog,
  mergeMeasurementCatalogDetails,
  mapProductCreateRequest,
  mapProductPage,
  mapStorefrontConfigRequest,
  mapVendorContext,
  mapVendorProfile,
  mapVendorSkus,
  type CheckoutDeliveryInput,
  type CheckoutPaymentInput,
  type StorefrontConfigInput,
} from './vendor-onboarding'

describe('catalog reference images', () => {
  it('keeps both icon and image_path for category and product references', () => {
    const categoryIcon = 'https://cdn.example.test/categories/icon.svg'
    const categoryImage = 'https://cdn.example.test/categories/image.jpg'
    const productIcon = 'https://cdn.example.test/products/icon.svg'
    const productImage = 'https://cdn.example.test/products/image.jpg'

    expect(mapCategoryPage({
      data: {
        result: [{
          id: 10,
          name: 'Produce',
          business_type_id: 7,
          description: 'Fresh produce',
          icon: categoryIcon,
          image_path: categoryImage,
        }],
        page_number: 0,
        total_pages: 1,
        last_page: true,
      },
    }).items[0]).toEqual(expect.objectContaining({ icon: categoryIcon, imageUrl: categoryImage }))

    expect(mapProductPage({
      data: {
        result: [{
          id: 20,
          name: 'Tomatoes',
          description: 'Fresh tomatoes',
          icon: productIcon,
          image_path: productImage,
          measurement_id: 2,
          measurement_name: 'COUNT',
        }],
        page_number: 0,
        total_pages: 1,
        last_page: true,
      },
    }).items[0]).toEqual(expect.objectContaining({ icon: productIcon, imageUrl: productImage }))
  })
})

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
  it('restores structured quantities and the price record needed for edits', () => {
    const [sku] = mapVendorSkus({ data: { result: [{
      vendor_product_id: 900, sku_id: 4021, price_id: 8021,
      sku_name: 'Milk-0.5 L', quantity_value: 0.5, unit: 'L',
      list_price: 60, sale_price: 55, is_active: false,
    }] } })

    expect(sku).toMatchObject({
      vendorProductId: 900, skuId: 4021, priceId: 8021,
      displayName: 'Milk', quantity: 0.5, unit: 'L', size: '0.5 L',
      listPrice: 60, salePrice: 55, isActive: false,
    })
  })

  it('prefers quantity_value and unit over a legacy size label', () => {
    const [sku] = mapVendorSkus({ data: [{
      vendor_product_id: 900, sku_id: 4021, sku_name: 'Milk',
      quantity_value: 250, unit: 'ml', sku_size: '1 L',
    }] })

    expect(sku).toMatchObject({ quantity: 250, unit: 'ml', size: '250 ml' })
  })

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

describe('mapStorefrontConfigRequest — national WhatsApp numbers reach the backend in E.164', () => {
  function storefrontInput(overrides: Partial<StorefrontConfigInput> = {}): StorefrontConfigInput {
    return {
      storeName: 'Lakshmi Home Foods',
      tagline: '',
      businessLocation: 'Hyderabad',
      instagram: '',
      orderWhatsapp: '9876543210',
      supportWhatsapp: '',
      welcomeMessage: '',
      announcementBar: '',
      heroBadges: [],
      trustStrip: [],
      theme: {
        primaryColor: '#10b981',
        accentColor: '#f59e0b',
        backgroundColor: '#ffffff',
        textColor: '#111827',
        fontFamily: 'Inter',
        buttonShape: 'ROUNDED',
        cardStyle: 'SHADOW',
        themePreset: 'FRESH',
      },
      ...overrides,
    }
  }

  it('adds the +91 country code to the national order number exactly once', () => {
    const request = mapStorefrontConfigRequest(storefrontInput({ orderWhatsapp: '9876543210' }))
    expect(request.order_whatsapp_number).toBe('+919876543210')
  })

  it('adds +91 to a provided support number', () => {
    const request = mapStorefrontConfigRequest(storefrontInput({ supportWhatsapp: '8123456789' }))
    expect(request.support_whatsapp_number).toBe('+918123456789')
  })

  it('leaves an absent support number absent rather than sending a prefix-only value', () => {
    const request = mapStorefrontConfigRequest(storefrontInput({ supportWhatsapp: '   ' }))
    expect(request.support_whatsapp_number).toBeUndefined()
  })
})

/**
 * The console has no accept step (docs/adr/0004-new-means-scheduled.md), so a vendor who
 * could still choose manual approval might end up with orders no control can move forward.
 * The choice is gone from setup, and the wire value is a constant here rather than
 * something a caller passes — a save cannot express any other policy.
 */
describe('checkout options — order acceptance is not a vendor choice', () => {
  function deliveryInput(overrides: Partial<CheckoutDeliveryInput> = {}): CheckoutDeliveryInput {
    return {
      fulfillmentType: 'HOME_DELIVERY',
      schedulingStrategy: 'FIXED_WINDOW',
      fixedWindow: { minDeliveryDays: 1, maxDeliveryDays: 4 },
      customerSelectDate: { minAdvanceBookingDays: 0, maxAdvanceBookingDays: 7, cutoffTime: '18:00' },
      predefinedDays: { days: ['MONDAY'], maxOrdersPerDay: 10 },
      instant: {
        minPrepTimeMinutes: 30,
        maxPrepTimeMinutes: 60,
        operatingUntil: '21:00',
        orderCutoffTime: '20:00',
      },
      shippingStrategy: 'FLAT',
      shipping: { charge: 25, freeDeliveryThreshold: 0 },
      slots: [],
      consentTitle: '',
      consentText: '',
      ...overrides,
    }
  }

  const payments: CheckoutPaymentInput = {
    options: [{ type: 'CASH_ON_DELIVERY', enabled: true, isDefault: true }],
    details: {
      upiId: '',
      upiAccountHolderName: '',
      bankAccountHolderName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      bankName: '',
    },
  }

  it('sends AUTO_ACCEPT on every save, whatever else the delivery config says', () => {
    expect(mapCheckoutOptionsRequest(deliveryInput(), payments).order_acceptance_policy)
      .toBe('AUTO_ACCEPT')
    expect(mapCheckoutOptionsRequest(
      deliveryInput({ fulfillmentType: 'STORE_PICKUP', schedulingStrategy: 'INSTANT' }),
      payments,
    ).order_acceptance_policy).toBe('AUTO_ACCEPT')
  })

  it('cannot carry a server-recorded MANUAL_APPROVAL back into the next save', () => {
    // The probe could not flip the one dev vendor that has a checkout config, so a live
    // MANUAL_APPROVAL record is still possible. The read drops it — there is nowhere for it
    // to land — so the config a resumed wizard rebuilds has no policy to hand back.
    const snapshot = mapCheckoutOptionsResponse({
      data: {
        fulfillment_type: 'HOME_DELIVERY',
        order_acceptance_policy: 'MANUAL_APPROVAL',
        delivery_options: {
          scheduling_strategy: 'FIXED_WINDOW',
          scheduling_config: { min_delivery_days: 1, max_delivery_days: 4 },
          shipping_config: { delivery_charge: 25, free_delivery_threshold: 500 },
        },
        delivery_slots: ['09:00 - 12:00'],
        payment_options: [{ type: 'CASH_ON_DELIVERY', default: true }],
      },
    })
    if (!snapshot) throw new Error('the checkout read returned nothing to resume from')

    // Everything the wizard restores from that record, sent again by the next save. The
    // wizard rewrites the whole checkout config, which is what corrects the stored policy.
    const resaved = mapCheckoutOptionsRequest(
      deliveryInput({
        fulfillmentType: snapshot.fulfillmentType ?? 'BOTH',
        schedulingStrategy: snapshot.schedulingStrategy ?? 'INSTANT',
        slots: snapshot.slots,
      }),
      payments,
    )

    expect(resaved.fulfillment_type).toBe('HOME_DELIVERY')
    expect(resaved.delivery_slots).toEqual(['09:00 - 12:00'])
    expect(resaved.order_acceptance_policy).toBe('AUTO_ACCEPT')
  })
})
