import type { VendorOrderCharges } from '@/modules/vendor/types/dashboard'

/**
 * How an order's charges are presented, and what is said when they do not add up.
 *
 * The rule is that nothing is derived. The backend sends `gross_amount`, `discount`,
 * `delivery_charges`, `service_charge` and `tax_amount`, omitting whichever it has no value
 * for, and a vendor screen shows exactly that set. Computing the missing one from the total
 * would put a figure on screen that no system holds — and the vendor is the person a
 * customer would ask about it.
 *
 * When the carried charges and the total disagree, that is said plainly rather than closed.
 */

export type ChargeLine = {
  key: string
  label: string
  /** Signed: a discount contributes negatively, so the lines simply add to the total. */
  amount: number
}

/** Rupees and paise. A hundredth of a rupee apart is rounding, not a real mismatch. */
const TOLERANCE = 0.005

export function chargeLines(charges: VendorOrderCharges): ChargeLine[] {
  const lines: ChargeLine[] = []
  // "Items before discount", not "Items": `gross_amount` is the pre-discount figure, while
  // each line's `line_total` is post-discount. Measured on live orders 1923 and 1925, where
  // the lines summed to exactly `gross_amount − discount` both times. Labelling this "Items"
  // would sit it under a list of lines that add up to a visibly different number.
  if (charges.gross != null) {
    lines.push({ key: 'gross', label: 'Items before discount', amount: charges.gross })
  }
  if (charges.discount != null) {
    lines.push({ key: 'discount', label: 'Discount', amount: -charges.discount })
  }
  if (charges.deliveryCharges != null) {
    lines.push({ key: 'delivery', label: 'Delivery', amount: charges.deliveryCharges })
  }
  if (charges.serviceCharge != null) {
    lines.push({ key: 'service', label: 'Service charge', amount: charges.serviceCharge })
  }
  if (charges.tax != null) lines.push({ key: 'tax', label: 'Tax', amount: charges.tax })
  return lines
}

/**
 * Whether the carried charges add up to the order total.
 *
 * `null` means the question cannot be asked — no total, or no breakdown. `false` means they
 * genuinely disagree, which happens when the backend omits a charge it nonetheless included
 * in the total. The screen says so; it does not invent the missing line.
 */
export function chargesReconcile(charges: VendorOrderCharges, total: number | null): boolean | null {
  const lines = chargeLines(charges)
  if (total == null || !lines.length) return null
  const sum = lines.reduce((running, line) => running + line.amount, 0)
  return Math.abs(sum - total) < TOLERANCE
}
