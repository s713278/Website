import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CustomerContact } from '@/modules/vendor/components/CustomerContact'
import { presentDeliveryStatus, presentPaymentStatus } from '@/modules/vendor/lib/order-actions'
import { deliveryStatusPillClass } from '@/modules/vendor/lib/status-pill'
import { DELIVERY_DATE_LABEL, deliveryDayLabel } from '@/modules/vendor/lib/work-queue'
import type { VendorOrderSummary } from '@/modules/vendor/types/dashboard'
import { cn, formatCurrency } from '@/shared/lib/utils'

/**
 * The console's one way of showing a list of orders. Overview and Orders both render it, so a
 * vendor moving between them reads the same shape twice rather than learning it again.
 *
 * The table from `design-reference/dashboard.html`: tracked-out micro-heads over ruled rows,
 * the whole thing sitting inside a `DashboardPanel` the caller owns rather than carrying a
 * panel of its own — which is what lets Orders put its filter chips above these rows and
 * inside the same frame, exactly as the reference does.
 *
 * Not a card per order: thirteen separately edged cards are thirteen things to look at, and a
 * vendor working down a delivery day is comparing rows — which only line up if they share a
 * set of columns.
 *
 * Three things the reference layout had are missing here, and none of them is an oversight:
 *
 * - **How long ago the order came in.** No order read in the contract carries a creation
 *   timestamp, so the ledger is organised around the delivery date instead — the only date
 *   there is.
 * - **What is in the order.** The list row carries `items_count` but no line items, so
 *   "Mango Pickle × 1" would need the per-order items call, one request per row.
 * - **The customer's name.** The list row carries `mobile` and nothing else identifying;
 *   `CustomerContact` renders a name above the number the moment a read supplies one, and the
 *   list read never has. Ask 2.1 is the list enrichment that would fill it.
 */

/**
 * Where the stack turns into a table, and why it is not one breakpoint.
 *
 * The rail takes 15.5rem from `lg` up, so the panel is far narrower than the window: at
 * 1024px a six-column row has about 730px to live in and every cell wraps. Orders carries six
 * columns and waits for `xl`; Overview carries four and can afford `lg`. Both sets are written
 * out in full because a class name assembled from a prefix is a class name Tailwind never sees.
 *
 * `stacked` is the one alignment switch. Below the breakpoint a cell is a label-and-value
 * line, so the value hangs off the right edge; as a table column it starts at the left like
 * everything else. Nothing in the table is right-aligned any more: the amount used to be,
 * which pushed the figures across their column and left them touching the status pill in the
 * next one while a hand's width of nothing sat between the delivery date and them. Every
 * column now begins on its own vertical, one `px-3` gutter apart, and the row reads as an
 * even rhythm rather than two crowded pairs.
 */
const WIDE = {
  head: 'hidden xl:table-header-group',
  row: 'block border-l-[3px] py-2.5 xl:table-row xl:py-0',
  cell: 'flex items-baseline justify-between gap-4 px-3 py-1 xl:table-cell xl:py-3.5 xl:align-middle',
  block: 'block px-3 py-1 xl:table-cell xl:py-3.5 xl:align-middle',
  label: 'text-xs text-[var(--md-muted)] xl:hidden',
  stacked: 'text-right xl:text-left',
}

const NARROW = {
  head: 'hidden lg:table-header-group',
  row: 'block border-l-[3px] py-2.5 lg:table-row lg:py-0',
  cell: 'flex items-baseline justify-between gap-4 px-3 py-1 lg:table-cell lg:py-3.5 lg:align-middle',
  block: 'block px-3 py-1 lg:table-cell lg:py-3.5 lg:align-middle',
  label: 'text-xs text-[var(--md-muted)] lg:hidden',
  stacked: 'text-right lg:text-left',
}

const HEAD_CELL = 'vc-label px-3 py-2 text-left'

export type OrderLedgerProps = {
  orders: VendorOrderSummary[]
  /** Today as `YYYY-MM-DD`, from the caller, so every row on one screen agrees on "today". */
  todayIso: string
  /** Names the list for a screen reader; the visible heading lives on the panel. */
  caption: string
  /**
   * Overview leaves this off. The console's one money figure belongs beside the range it
   * describes, and a total on a queue would describe a window the vendor did not choose.
   */
  showAmount?: boolean
  /** Carried into history so the detail screen's own "Back to orders" restores this view. */
  linkState?: unknown
  /**
   * The one move the row is waiting for. Its column holds nothing else, so the right edge of
   * the ledger reads as a single list of what to do next.
   */
  renderNextStep?: (order: VendorOrderSummary) => ReactNode
  /** Sits under the amount: a money action belongs with the money fact it changes. */
  renderPaymentAction?: (order: VendorOrderSummary) => ReactNode
}

export function OrderLedger({
  orders,
  todayIso,
  caption,
  showAmount = false,
  linkState,
  renderNextStep,
  renderPaymentAction,
}: OrderLedgerProps) {
  const style = showAmount || renderNextStep ? WIDE : NARROW

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>

        {/*
          The rule under this row is `--vc-edge` where the rules between rows are the lighter
          `--vc-rule`. That difference is what lets the heads be this quiet: the heavier line
          says "chrome ends here", so the labels do not have to. They earn their place by
          taking the repeated words out of every row — the date cell can read "Today" only
          because this row says which date that is.
        */}
        <thead className={style.head}>
          <tr className="border-b border-[var(--vc-edge)]">
            <th scope="col" className={cn(HEAD_CELL, 'w-[6rem]')}>
              Order
            </th>
            {/*
              Every column is measured, including the last. Leave one unmeasured and it swallows
              all the leftover width, opening a gap beside it that no other column has; measured
              throughout, the leftover is spread across all of them and the gutters stay even.
              The four widths Overview also uses are the same numbers here, so the two screens
              put their shared columns on the same verticals.
            */}
            <th scope="col" className={cn(HEAD_CELL, 'w-[15rem]')}>
              Customer
            </th>
            <th scope="col" className={cn(HEAD_CELL, 'w-[9rem]')}>
              {DELIVERY_DATE_LABEL}
            </th>
            {showAmount ? (
              <th scope="col" className={cn(HEAD_CELL, 'w-[9rem]')}>
                Amount
              </th>
            ) : null}
            <th scope="col" className={cn(HEAD_CELL, 'w-[9rem]')}>
              Status
            </th>
            {renderNextStep ? (
              <th scope="col" className={cn(HEAD_CELL, 'w-[13rem]')}>
                Next step
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody className="vc-rows">
          {orders.map((order) => {
            const day = deliveryDayLabel(order.deliveryDate, todayIso)
            const delivery = presentDeliveryStatus(order.deliveryStatus)
            const payment = order.paymentStatus ? presentPaymentStatus(order.paymentStatus) : null

            return (
              <tr
                key={order.id}
                className={cn(
                  // Lateness keeps the left rule to itself. It is the one thing in this block
                  // that must survive a glance taking in nothing else, so it is also the only
                  // red: every other state is told in words and in the status pill's own hue.
                  style.row,
                  'transition-colors hover:bg-slate-50/70',
                  day.overdue ? 'border-l-[var(--md-danger)]' : 'border-l-transparent',
                )}
              >
                <td className={style.block}>
                  {/*
                    Under the "Order" head the word is redundant, but a row read out of the
                    table — by a screen reader, or from the rotor's list of links — is just
                    "#4021" without it. The label carries the word the column would.
                  */}
                  <Link
                    to={`/vendor/orders/${order.id}`}
                    state={linkState}
                    aria-label={`Order #${order.id}`}
                    className="vc-num font-semibold hover:underline"
                  >
                    #{order.id}
                  </Link>
                </td>

                <td className={style.block}>
                  <CustomerContact name={order.customerName} mobile={order.customerMobile} />
                </td>

                <td className={style.cell}>
                  <span className={style.label}>{DELIVERY_DATE_LABEL}</span>
                  <span className={style.stacked}>
                    <span
                      className={cn(
                        'vc-num block',
                        day.overdue
                          ? 'font-medium text-[var(--md-danger)]'
                          : 'text-[var(--md-ink)]',
                      )}
                    >
                      {day.headline}
                    </span>
                    {day.detail ? (
                      <span className="vc-num block text-xs text-[var(--md-muted)]">
                        {day.detail}
                      </span>
                    ) : null}
                  </span>
                </td>

                {/*
                  Money facts stay in the money column: the amount, and whether it has come in.
                  `null` is an unknown amount and `0` a genuinely free order — rendering both as
                  nothing, or both as ₹0, would merge two facts.

                  "Payment due" is the state nearly every order is in, so it stays quiet and
                  "Paid" is the one that carries colour. An amber on every row would be a second
                  alarm competing with the only one that means drop everything.
                */}
                {showAmount ? (
                  <td className={style.cell}>
                    <span className={style.label}>Amount</span>
                    <span className={style.stacked}>
                      {order.total != null ? (
                        <span className="vc-num block font-semibold whitespace-nowrap">
                          {formatCurrency(order.total)}
                        </span>
                      ) : (
                        <span className="block text-slate-500">Amount not available</span>
                      )}
                      {payment ? (
                        <span
                          className={cn(
                            'block text-xs whitespace-nowrap',
                            payment.tone === 'success'
                              ? 'font-medium text-[var(--vc-tint-ink)]'
                              : 'text-[var(--md-muted)]',
                          )}
                        >
                          {payment.label}
                        </span>
                      ) : null}
                      {renderPaymentAction ? (
                        <span className="mt-1 block">{renderPaymentAction(order)}</span>
                      ) : null}
                    </span>
                  </td>
                ) : null}

                <td className={style.cell}>
                  <span className={style.label}>Status</span>
                  <span className={deliveryStatusPillClass(order.deliveryStatus)}>
                    {delivery.label}
                  </span>
                </td>

                {renderNextStep ? (
                  <td className={cn(style.block, 'pt-2 xl:py-3.5')}>
                    <span className="flex justify-end xl:justify-start">
                      {renderNextStep(order)}
                    </span>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
