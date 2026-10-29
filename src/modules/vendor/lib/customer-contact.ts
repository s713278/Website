/**
 * Turning an order's `mobile` into something tappable.
 *
 * A list row carries no customer name — only `mobile` — so the phone number is the whole
 * of the customer's identity on that screen. It is presented as an action rather than as a
 * name: a vendor who needs to reach someone about an order taps to call or message, and a
 * bare number rendered where a name belongs just reads as a bug.
 */

/** Matches the country code the app registers accounts under. */
const DEFAULT_COUNTRY_CODE = '91'

/**
 * The digits to dial, or `null` when there is nothing usable.
 *
 * Returning `null` rather than a best-effort string is deliberate: the caller uses it to
 * decide whether to render the controls at all, and a call button that dials nothing is
 * worse than no button.
 */
export function toDialableNumber(mobile: string | null): string | null {
  if (!mobile) return null

  const digits = mobile.replace(/\D/g, '')
  if (digits.length < 10) return null
  // A local 10-digit number needs the country code prefixed for `wa.me`; anything longer
  // already carries one.
  return digits.length === 10 ? `${DEFAULT_COUNTRY_CODE}${digits}` : digits
}

/**
 * A `wa.me` link with **no prefilled message**.
 *
 * Sending stays a deliberate act by the vendor. Prefilling text would make the tap feel
 * like it had already sent something, and the console has no business composing messages
 * to a customer on the vendor's behalf.
 */
export function whatsAppLink(mobile: string | null): string | null {
  const number = toDialableNumber(mobile)
  return number ? `https://wa.me/${number}` : null
}

export function callLink(mobile: string | null): string | null {
  const number = toDialableNumber(mobile)
  return number ? `tel:+${number}` : null
}

/** How a number reads on screen when it stands in for a name. */
export function formatMobile(mobile: string | null): string | null {
  if (!mobile) return null
  const digits = mobile.replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`
  return mobile
}
