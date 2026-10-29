import {
  hasDeliveryRange,
  matchingPreset,
  NO_RANGE,
  ORDER_STATUS_FILTERS,
  presetRange,
  RANGE_PRESETS,
  type DeliveryRange,
} from '@/modules/vendor/lib/order-filters'
import { presentDeliveryStatus } from '@/modules/vendor/lib/order-actions'
import { vendorFilterChipClass } from '@/modules/vendor/lib/filter-chip'
import type { DeliveryStatus } from '@/modules/vendor/types/dashboard'
import { Button, Input } from '@/shared/components'

/**
 * The two questions the orders list is narrowed by: which state, and which delivery days.
 *
 * One line per question, and every line starts on the same vertical — a fixed label column
 * on the left, controls to the right of it. Both rows previously carried their label inline
 * ahead of the chips, so "Status" and "Delivery date" pushed their chips to two different
 * left edges and the block read as loose parts rather than two rows of one control.
 *
 * The shortcuts and the exact range share the delivery-date row, because they answer the
 * same question and only one of them is ever in use. Splitting them onto their own block
 * cost three lines of vertical space and said "delivery date" three times over — the row's
 * own label carries the words now, so the fields need only say From and To.
 *
 * A tinted surface, one step lighter than the subtotal strip below it, so the controls read
 * as chrome acting on the list rather than as another row of it.
 */
export type OrderFilterBarProps = {
  status: DeliveryStatus | null
  range: DeliveryRange
  /**
   * Fixed for the life of the screen by the caller: the preset chips must not shift under
   * the vendor if midnight passes while they are looking at them.
   */
  today: Date
  onApply: (next: { status?: DeliveryStatus | null; range?: DeliveryRange }) => void
}

export function OrderFilterBar({ status, range, today, onApply }: OrderFilterBarProps) {
  const activePreset = matchingPreset(range, today)
  const rangeApplied = hasDeliveryRange(range)

  return (
    <div className="mb-4 rounded-xl border border-[var(--vc-edge)] bg-[var(--vc-rail-bg)] px-3.5 py-3">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-[7.5rem_1fr]">
        {/*
          The visible label is the column head for the row; the group's own name spells out
          what these chips are of. "Status" alone, read out of the row, could be any of them.
        */}
        <span className="vc-label sm:pt-2">Status</span>
        <div
          role="group"
          aria-label="Order status"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => onApply({ status: null })}
            aria-pressed={status === null}
            className={vendorFilterChipClass(status === null)}
          >
            All
          </button>
          {ORDER_STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onApply({ status: value })}
              aria-pressed={status === value}
              className={vendorFilterChipClass(status === value)}
            >
              {presentDeliveryStatus(value).label}
            </button>
          ))}
        </div>

        {/*
          Every control in this group says "delivery date" — the row label for the chips, the
          accessible names on the two fields — and that is not decoration. It is the only date
          the contract carries: there is no creation timestamp on any order read, so a control
          labelled "date" would be read as an order date and quietly answer a different
          question than the one it was asked.
        */}
        <span className="vc-label sm:pt-2">Delivery date</span>
        <div
          role="group"
          aria-label="Delivery date"
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGE_PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onApply({ range: activePreset === key ? NO_RANGE : presetRange(key, today) })
                }
                aria-pressed={activePreset === key}
                className={vendorFilterChipClass(activePreset === key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/*
            The fields sit beside the shortcuts rather than under them: they are two ways to
            answer one question, and a vendor reaching past "Next 7 days" for an exact window
            should not have to look somewhere else to find it.

            Their labels are beside the fields and read From and To, so the row stays one
            line and the words "delivery date" are said once, by the row. The accessible
            name still spells it out in full — a screen reader hears the field on its own,
            with no row label to carry the context.
          */}
          {/*
            One wrapper around both fields and the reset, so that when the panel is too narrow
            to hold the whole row they wrap as a unit. Left loose, To dropped to the next line
            on its own and landed under the shortcuts rather than under From.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="delivery-date-from" className="vc-label min-w-10 sm:min-w-0">
                From
              </label>
              <div className="w-[9.25rem]">
                <Input
                  type="date"
                  name="delivery-date-from"
                  aria-label="Delivery date from"
                  className="h-9"
                  value={range.startDate ?? ''}
                  onChange={(event) =>
                    onApply({ range: { ...range, startDate: event.target.value || null } })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="delivery-date-to" className="vc-label min-w-10 sm:min-w-0">
                To
              </label>
              <div className="w-[9.25rem]">
                <Input
                  type="date"
                  name="delivery-date-to"
                  aria-label="Delivery date to"
                  className="h-9"
                  value={range.endDate ?? ''}
                  onChange={(event) =>
                    onApply({ range: { ...range, endDate: event.target.value || null } })
                  }
                />
              </div>
            </div>

            {/*
              A link rather than a chip. As a chip it sat in the same row as Today and This
              week wearing the same shape, so the one control that undoes a choice looked
              like a fourth thing to choose.
            */}
            {rangeApplied ? (
              <Button
                variant="link"
                size="sm"
                className="h-9 p-0 text-xs"
                onClick={() => onApply({ range: NO_RANGE })}
              >
                Clear dates
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
