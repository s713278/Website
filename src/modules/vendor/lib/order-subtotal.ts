import type { VendorOrderPage } from '@/modules/vendor/types/dashboard'

/**
 * The delivery-window subtotal: the console's one money figure.
 *
 * It is a second pass over the same filter the list uses, not a sum of the rows on screen.
 * A page holds twenty orders; a week can hold more. Totalling what is visible and labelling
 * it with the whole range is the kind of quiet wrongness this console is being rebuilt to
 * remove — the figure would look complete and be short.
 *
 * Three rules, in order of how badly breaking them would mislead a vendor:
 *
 * 1. **Withheld entirely on any failure.** If one page does not arrive, there is no total.
 * 2. **Withheld entirely if any row has no amount.** `null` means unknown, not zero, and a
 *    sum that skips the unknown rows is a smaller number presented as the real one.
 * 3. **Refused, not truncated, past the cap.** Beyond ten pages the vendor is told the range
 *    is too large rather than shown the first thousand orders' worth.
 *
 * The walk takes a fetcher rather than calling a service, so the whole rule set is testable
 * at the logic tier with no network and no mode.
 */

/** Bigger than the list's page size: fewer round trips for a figure nobody pages through. */
export const SUBTOTAL_PAGE_SIZE = 100

/** Ten pages at that size. Past this the range is refused, never partially totalled. */
export const SUBTOTAL_PAGE_CAP = 10

export type SubtotalOutcome =
  | { kind: 'total'; amount: number; orders: number }
  | { kind: 'too-large' }
  /** `error` is carried so the screen can say *why* through `getErrorMessage`, not just that. */
  | { kind: 'withheld'; reason: 'failed'; error: unknown }
  | { kind: 'withheld'; reason: 'missing-amount' }

/**
 * @param fetchPage must request `SUBTOTAL_PAGE_SIZE` rows — the walk uses the returned row
 * count as its own evidence that a page is the last one.
 */
export async function sumDeliveryWindow(
  fetchPage: (page: number) => Promise<VendorOrderPage>,
): Promise<SubtotalOutcome> {
  let amount = 0
  let orders = 0

  for (let page = 0; page < SUBTOTAL_PAGE_CAP; page += 1) {
    let result: VendorOrderPage
    try {
      result = await fetchPage(page)
    } catch (error) {
      return { kind: 'withheld', reason: 'failed', error }
    }

    // The first response already declares how many pages there are, so an over-large range
    // is refused before walking it rather than after.
    if (page === 0 && result.totalPages > SUBTOTAL_PAGE_CAP) return { kind: 'too-large' }

    for (const order of result.orders) {
      if (order.total == null) return { kind: 'withheld', reason: 'missing-amount' }
      amount += order.total
      orders += 1
    }

    // `lastPage` alone is not enough to stop on. `mapVendorOrderPage` reads it as
    // `last_page !== false`, so a response that simply omits the field claims to be the last
    // one — and a page-0-only sum would then be rendered under a heading naming the whole
    // range, complete-looking and short. A page that came back short is its own evidence;
    // a full page means there may be more, whatever the metadata says.
    if (result.lastPage && result.orders.length < SUBTOTAL_PAGE_SIZE) {
      return { kind: 'total', amount, orders }
    }
  }

  // Walked the cap and the server still says there is more. Trusting `total_pages` alone
  // would leave this case producing a partial figure.
  return { kind: 'too-large' }
}
