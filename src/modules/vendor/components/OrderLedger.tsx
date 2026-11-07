import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CustomerContact } from '@/modules/vendor/components/CustomerContact'
import { shortCustomerName } from '@/modules/vendor/lib/customer-contact'
import {
  presentDeliveryStatus,
  presentPaymentStatus,
  VENDOR_ORDER_DETAILS_SHOWN,
  VENDOR_ORDER_WRITES_ENABLED,
} from '@/modules/vendor/lib/order-actions'
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
 * Below the breakpoint each row is a small grid rather than a column of label-and-value
 * lines, which on a phone repeated the same three labels on every row and on a tablet left a
 * hand's width of nothing between each label and its value. Who the order is sits on the
 * left — the number, then the contact — and where it stands sits on the right: the status
 * pill, then the facts. On a phone the contact takes the full width and the facts drop under
 * it, delivery date left and amount right. Only the date keeps a visible label, because
 * "Tomorrow" alone does not say what is tomorrow; the amount and the status say what they
 * are by themselves, and keep their names for a screen reader. The next step, when there is
 * one, takes the last line at the right; on a phone the payment action shares that line at the
 * left, and from `sm` it sits under the payment line it changes.
 *
 * Every cell keeps its table-column place in the markup, so the table and a screen reader
 * read the same order; only grid placement moves them. Grid placement and margins do nothing
 * to a table cell, so the classes that build the stack fall away at the breakpoint.
 *
 * In the table nothing is right-aligned: the amount used to be, which pushed the figures
 * across their column and left them touching the status pill in the next one while a hand's
 * width of nothing sat between the delivery date and them. Every column begins on its own
 * vertical, one `px-3` gutter apart, and the row reads as an even rhythm rather than two
 * crowded pairs.
 *
 * The amount, payment and next-step keys exist only on `WIDE`: those cells render only when
 * `showAmount` or `renderNextStep` is set, and either one selects `WIDE`.
 */
const WIDE = {
  head: 'hidden xl:table-header-group',
  // Three tracks at every stack size, so no two lines have to share one split: on a phone
  // the pill spans the two right tracks of the first line and the date the two left tracks of
  // the facts line, and a long status cannot squeeze the date, nor a long date the status.
  row: 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 border-l-[3px] px-3 py-3 xl:table-row xl:px-0 xl:py-0',
  order: 'col-1 row-1 block xl:table-cell xl:px-3 xl:py-3.5 xl:align-middle',
  contact:
    'col-span-full row-2 mt-1 block sm:col-1 sm:row-[2/span_2] xl:table-cell xl:px-3 xl:py-3.5 xl:align-middle',
  date: 'col-[1/3] row-3 mt-2 flex items-baseline gap-1.5 max-xl:whitespace-nowrap sm:col-2 sm:row-2 sm:mt-1 sm:justify-self-end sm:text-right xl:table-cell xl:px-3 xl:py-3.5 xl:text-start xl:align-middle',
  dateLabel: 'text-xs text-[var(--md-muted)] xl:hidden',
  // The money cell's own box steps aside below the breakpoint so its three lines can each
  // take a place in the row: the figure and whether it is paid on the right, and the action
  // at the foot on a phone, within thumb reach. From `sm` the action sits directly under the
  // payment line instead, beside the money it changes rather than a panel's width from it.
  // At the breakpoint it is an ordinary cell again.
  amount: 'contents xl:table-cell xl:px-3 xl:py-3.5 xl:align-middle',
  amountValue:
    'col-3 row-3 mt-2 justify-self-end text-right sm:col-3 sm:row-2 sm:mt-1 xl:mt-0 xl:justify-self-auto xl:text-start',
  // "Amount not available" is the one long amount; on a phone it wraps in a narrow measure
  // so the date beside it keeps its single line. A figure never wraps.
  amountMissing: 'max-sm:max-w-[5.5rem]',
  payment: 'col-3 row-4 justify-self-end sm:col-3 sm:row-3 xl:justify-self-auto',
  paymentAction:
    'col-1 row-5 mt-2 block self-center empty:max-xl:hidden sm:col-3 sm:row-4 sm:mt-1 sm:justify-self-end xl:justify-self-auto',
  status:
    'col-[2/-1] row-1 block self-center justify-self-end xl:table-cell xl:px-3 xl:py-3.5 xl:align-middle',
  pill: 'max-xl:whitespace-nowrap',
  srLabel: 'sr-only xl:hidden',
  nextStep:
    'col-span-full row-5 block self-center justify-self-end xl:table-cell xl:px-3 xl:py-3.5 xl:align-middle',
  nextStepInner: 'mt-2 flex justify-end empty:hidden xl:mt-0 xl:justify-start',
}

const NARROW = {
  head: 'hidden lg:table-header-group',
  row: 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-l-[3px] px-3 py-3 lg:table-row lg:px-0 lg:py-0',
  order: 'col-1 row-1 block lg:table-cell lg:px-3 lg:py-3.5 lg:align-middle',
  contact: 'col-span-full row-2 mt-1 block sm:col-1 lg:table-cell lg:px-3 lg:py-3.5 lg:align-middle',
  date: 'col-1 row-3 mt-2 flex items-baseline gap-1.5 max-lg:whitespace-nowrap sm:col-2 sm:row-2 sm:mt-1 sm:justify-self-end sm:text-right lg:table-cell lg:px-3 lg:py-3.5 lg:text-start lg:align-middle',
  dateLabel: 'text-xs text-[var(--md-muted)] lg:hidden',
  status: 'col-2 row-1 block self-center justify-self-end lg:table-cell lg:px-3 lg:py-3.5 lg:align-middle',
  pill: 'max-lg:whitespace-nowrap',
  srLabel: 'sr-only lg:hidden',
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
  // TEMP(vendor-orders-minimal-rows): no status or delivery date, so one row for both pages.
  if (!VENDOR_ORDER_DETAILS_SHOWN) {
    return (
      <MinimalOrderLedger
        orders={orders}
        caption={caption}
        linkState={linkState}
        renderNextStep={renderNextStep}
        renderPaymentAction={renderPaymentAction}
      />
    )
  }

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
                <td className={style.order}>
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

                <td className={style.contact}>
                  <CustomerContact name={order.customerName} mobile={order.customerMobile} />
                </td>

                <td className={style.date}>
                  <span className={style.dateLabel}>{DELIVERY_DATE_LABEL}</span>
                  <span>
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

                  TEMP(vendor-orders-read-only): the payment badge waits on the order-writes
                  switch; with orders read-only the console makes no claim about money.
                */}
                {showAmount ? (
                  <td className={WIDE.amount}>
                    <span className={WIDE.srLabel}>Amount</span>
                    {order.total != null ? (
                      <span
                        className={cn(
                          WIDE.amountValue,
                          'vc-num block font-semibold whitespace-nowrap',
                        )}
                      >
                        {formatCurrency(order.total)}
                      </span>
                    ) : (
                      <span
                        className={cn(WIDE.amountValue, WIDE.amountMissing, 'block text-slate-500')}
                      >
                        Amount not available
                      </span>
                    )}
                    {VENDOR_ORDER_WRITES_ENABLED && payment ? (
                      <span
                        className={cn(
                          WIDE.payment,
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
                      <span className={WIDE.paymentAction}>{renderPaymentAction(order)}</span>
                    ) : null}
                  </td>
                ) : null}

                <td className={style.status}>
                  <span className={style.srLabel}>Status</span>
                  <span className={cn(deliveryStatusPillClass(order.deliveryStatus), style.pill)}>
                    {delivery.label}
                  </span>
                </td>

                {renderNextStep ? (
                  <td className={WIDE.nextStep}>
                    <span className={WIDE.nextStepInner}>
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

/**
 * TEMP(vendor-orders-minimal-rows): the row while status and delivery date are hidden —
 * the order, the customer and the amount, the same three on Overview and Orders.
 *
 * Three columns fit a phone held sideways, so the table starts at `sm` on both pages. Below
 * it the order and its amount share the first line, number left and money right, and the
 * customer takes the full width under them. The amount is right-aligned here, unlike the
 * full row: with no status pill beside it there is nothing for the figures to crowd, and a
 * column of rupee totals is read down its right edge.
 *
 * The left rule the full row keeps for lateness is gone with the delivery date it measures.
 * When order writes are on, the payment line, its action and the next step stack under the
 * amount, so the row stays three columns.
 */
const MINIMAL = {
  head: 'hidden sm:table-header-group',
  row: 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 px-3 py-3 sm:table-row sm:px-0 sm:py-0',
  order: 'col-1 row-1 block sm:table-cell sm:px-3 sm:py-3.5 sm:align-top',
  contact: 'col-span-full row-2 mt-2 block sm:table-cell sm:mt-0 sm:px-3 sm:py-3.5 sm:align-top',
  amount:
    'col-2 row-1 block text-right sm:table-cell sm:px-3 sm:py-3.5 sm:text-right sm:align-top',
}

type MinimalOrderLedgerProps = Pick<
  OrderLedgerProps,
  'orders' | 'caption' | 'linkState' | 'renderNextStep' | 'renderPaymentAction'
>

function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

function MinimalOrderLedger({
  orders,
  caption,
  linkState,
  renderNextStep,
  renderPaymentAction,
}: MinimalOrderLedgerProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>

        <thead className={MINIMAL.head}>
          <tr className="border-b border-[var(--vc-edge)]">
            <th scope="col" className={cn(HEAD_CELL, 'w-[7rem]')}>
              Order
            </th>
            <th scope="col" className={HEAD_CELL}>
              Customer
            </th>
            <th scope="col" className={cn(HEAD_CELL, 'w-[10rem] text-right')}>
              Amount
            </th>
          </tr>
        </thead>

        <tbody className="vc-rows">
          {orders.map((order) => {
            const payment = order.paymentStatus ? presentPaymentStatus(order.paymentStatus) : null

            return (
              <tr
                key={order.id}
                className={cn(MINIMAL.row, 'transition-colors hover:bg-slate-50/70')}
              >
                <td className={MINIMAL.order}>
                  <Link
                    to={`/vendor/orders/${order.id}`}
                    state={linkState}
                    aria-label={`Order #${order.id}`}
                    className="vc-num font-semibold hover:underline"
                  >
                    #{order.id}
                  </Link>
                  {order.itemCount != null ? (
                    <span className="vc-num mt-0.5 block text-xs text-[var(--md-muted)] sm:mt-1 sm:leading-5">
                      {itemCountLabel(order.itemCount)}
                    </span>
                  ) : null}
                </td>

                <td className={MINIMAL.contact}>
                  <CustomerContact
                    name={shortCustomerName(order.customerName)}
                    mobile={order.customerMobile}
                    stacked
                  />
                </td>

                <td className={MINIMAL.amount}>
                  <span className="sr-only sm:hidden">Amount</span>
                  {order.total != null ? (
                    <span className="vc-num block font-semibold whitespace-nowrap text-[var(--md-ink)]">
                      {formatCurrency(order.total)}
                    </span>
                  ) : (
                    <span className="block text-[var(--md-muted)] max-sm:max-w-[6rem] sm:whitespace-nowrap">
                      Amount not available
                    </span>
                  )}
                  {/* TEMP(vendor-orders-read-only): no payment claim while orders are read-only. */}
                  {VENDOR_ORDER_WRITES_ENABLED && payment ? (
                    <span
                      className={cn(
                        'mt-0.5 block text-xs whitespace-nowrap',
                        payment.tone === 'success'
                          ? 'font-medium text-[var(--vc-tint-ink)]'
                          : 'text-[var(--md-muted)]',
                      )}
                    >
                      {payment.label}
                    </span>
                  ) : null}
                  {renderPaymentAction ? (
                    <span className="mt-1 flex justify-end empty:hidden">
                      {renderPaymentAction(order)}
                    </span>
                  ) : null}
                  {renderNextStep ? (
                    <span className="mt-2 flex justify-end empty:hidden">
                      {renderNextStep(order)}
                    </span>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
