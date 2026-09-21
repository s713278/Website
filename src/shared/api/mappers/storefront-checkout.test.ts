import { describe, expect, it } from 'vitest'
import {
  formatCheckoutDateLabel,
  mapStorefrontCheckoutOptions,
} from './storefront-checkout'

describe('mapStorefrontCheckoutOptions', () => {
  it('maps live checkout_options with dates, payments, shipping, and consent', () => {
    const mapped = mapStorefrontCheckoutOptions({
      timestamp: '2026-09-18T23:42:26.574874547',
      success: true,
      status: 200,
      data: {
        delivery_methods: ['HOME_DELIVERY'],
        delivery_options: {
          scheduling_strategy: 'FIXED_WINDOW',
          eligible_delivery_dates: ['2026-09-19', '2026-09-20', '2026-09-21'],
          scheduling_config: {
            max_delivery_days: 3,
            min_delivery_days: 1,
          },
          shipping_strategy_type: 'ORDER_AMOUNT_THRESHOLD',
          shipping_config: {
            delivery_charge: 30,
            free_delivery_threshold: 0,
          },
        },
        payment_options: [
          {
            id: 76,
            type: 'CASH_ON_DELIVERY',
            label: 'Cash on delivery',
            default: true,
          },
        ],
        customer_consent_title: 'Title',
        customer_consent_text: 'Test Consent',
        fulfillment_type: 'HOME_DELIVERY',
        order_acceptance_policy: 'AUTO_ACCEPT',
        delivery_slots: [],
      },
    })

    expect(mapped?.deliveryMethods).toEqual(['HOME_DELIVERY'])
    expect(mapped?.schedulingStrategy).toBe('FIXED_WINDOW')
    expect(mapped?.availableDeliveryDates).toEqual([
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
    ])
    expect(mapped?.deliverySlots.map((slot) => slot.id)).toEqual([
      'date-2026-09-19',
      'date-2026-09-20',
      'date-2026-09-21',
    ])
    expect(mapped?.deliverySlots[0]?.date).toBe('2026-09-19')
    expect(mapped?.deliverySlots[0]?.label).toBe(formatCheckoutDateLabel('2026-09-19'))
    expect(mapped?.paymentOptions).toEqual([
      { id: '76', label: 'Cash on delivery', type: 'CASH_ON_DELIVERY', isDefault: true },
    ])
    expect(mapped?.shipping).toEqual({
      deliveryCharge: 30,
      freeDeliveryThreshold: 0,
    })
    expect(mapped?.consentTitle).toBe('Title')
    expect(mapped?.consentText).toBe('Test Consent')
    expect(mapped?.fulfillmentType).toBe('HOME_DELIVERY')
    expect(mapped?.orderAcceptancePolicy).toBe('AUTO_ACCEPT')
  })

  it('still accepts older available_delivery_dates examples', () => {
    const mapped = mapStorefrontCheckoutOptions({
      success: true,
      data: {
        delivery_methods: ['HOME_DELIVERY'],
        delivery_options: {
          scheduling_strategy: 'CUSTOMER_SELECT_DATE',
          shipping_config: {
            delivery_charge: 30,
            free_delivery_threshold: 300,
          },
          available_delivery_dates: ['2026-04-17', '2026-04-18'],
        },
        payment_options: [
          { type: 'CASH_ON_DELIVERY', default: true },
          { type: 'ONLINE', is_default: false },
        ],
        pickup_options: null,
      },
    })

    expect(mapped?.deliverySlots.map((slot) => slot.id)).toEqual([
      'date-2026-04-17',
      'date-2026-04-18',
    ])
    expect(mapped?.paymentOptions.map((option) => option.id)).toEqual(['cod', 'online'])
    expect(mapped?.paymentOptions[0]?.isDefault).toBe(true)
    expect(mapped?.shipping.deliveryCharge).toBe(30)
  })

  it('prefers delivery_slots time windows when present', () => {
    const mapped = mapStorefrontCheckoutOptions({
      data: {
        delivery_slots: ['6 PM - 9 PM', '9 PM - 12 AM'],
        delivery_options: {
          eligible_delivery_dates: ['2026-04-17'],
        },
      },
    })

    expect(mapped?.deliverySlots.map((slot) => slot.label)).toEqual([
      '6 PM - 9 PM',
      '9 PM - 12 AM',
    ])
  })
})
