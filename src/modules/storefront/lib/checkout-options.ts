export const DELIVERY_SLOTS = [
  {
    id: '6-9pm',
    label: '6 PM - 9 PM',
    description: 'Preferred delivery time',
    recommended: true,
  },
  {
    id: '9-12am',
    label: '9 PM - 12 AM',
    description: 'Late night delivery',
  },
] as const

export const PAYMENT_OPTIONS = [
  { id: 'cod', label: 'Cash on Delivery' },
  { id: 'upi', label: 'UPI / Card / Net Banking' },
] as const

export type DeliverySlotId = (typeof DELIVERY_SLOTS)[number]['id']
export type PaymentOptionId = (typeof PAYMENT_OPTIONS)[number]['id']

export function deliverySlotLabel(id: DeliverySlotId) {
  return DELIVERY_SLOTS.find((slot) => slot.id === id)?.label ?? DELIVERY_SLOTS[0].label
}

export function paymentOptionLabel(id: PaymentOptionId) {
  return PAYMENT_OPTIONS.find((option) => option.id === id)?.label ?? PAYMENT_OPTIONS[0].label
}
