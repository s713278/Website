import { PencilIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import type { VendorSize } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorProductsService } from '@/shared/api'
import { Badge, Button, Label, ShadcnInput } from '@/shared/components'
import { cn, formatCurrency } from '@/shared/lib/utils'

/** The whole percent a selling price is under its MRP, rounded down; null when it is under 1%. */
function percentOff(sale: number | null, list: number | null): number | null {
  if (sale == null || list == null || list <= sale) return null
  return Math.floor(((list - sale) / list) * 100) || null
}

/** One rupee amount. The sign is decoration; the label alone names the field. */
function PriceField({
  label,
  value,
  inputRef,
  disabled,
  invalid,
  describedBy,
  onChange,
}: {
  label: string
  value: string
  inputRef?: Ref<HTMLInputElement>
  disabled: boolean
  invalid: boolean
  describedBy: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-[var(--md-muted)]"
        >
          ₹
        </span>
        <ShadcnInput
          id={id}
          ref={inputRef}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? describedBy : undefined}
          // A thin focus outline, as on the editor's feature cells.
          className="vc-num bg-white pl-7 text-base font-semibold focus-visible:border-[var(--md-green-600)] focus-visible:ring-0 aria-invalid:ring-0 md:text-base"
          // A price is usually retyped, not edited, so focusing selects it.
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}

/** What is wrong with a pair of typed prices, and which field to fix; null when they can be saved. */
function priceProblem(sale: number, list: number): { field: 'sale' | 'list'; message: string } | null {
  if (!Number.isFinite(sale) || sale <= 0) {
    return { field: 'sale', message: 'Enter the selling price as a number above 0.' }
  }
  if (!Number.isFinite(list) || list <= 0) {
    return { field: 'list', message: 'Enter the MRP as a number above 0.' }
  }
  if (sale > list) {
    return { field: 'sale', message: `The selling price cannot be more than the MRP of ${formatCurrency(list)}.` }
  }
  return null
}

/**
 * What the typed prices will do, in one place: how the shop will show them, or what to fix. The
 * shop shows the selling price, and strikes the MRP through only when it is higher.
 */
function PriceResult({
  problem,
  problemId,
  sale,
  list,
}: {
  problem: string | null
  problemId: string
  sale: number
  list: number
}) {
  const box = 'grid min-h-[4.25rem] content-center gap-0.5 rounded-lg px-3 py-2'
  if (problem) {
    return (
      <p id={problemId} className={cn(box, 'bg-red-50 text-[0.8125rem] leading-5 text-[var(--md-danger)]')}>
        {problem}
      </p>
    )
  }
  const off = percentOff(sale, list)
  return (
    <div className={cn(box, 'bg-slate-50')}>
      <p className="text-xs leading-4 text-[var(--md-muted)]">On your shop</p>
      <p className="vc-num flex flex-wrap items-baseline gap-x-2">
        <span className="text-lg leading-6 font-bold">{formatCurrency(sale)}</span>
        {list > sale ? <s className="text-sm text-[var(--md-muted)]">{formatCurrency(list)}</s> : null}
        {off ? <span className="text-xs font-semibold text-[var(--vc-tint-ink)]">{off}% off</span> : null}
      </p>
    </div>
  )
}

/**
 * One size's prices being changed. It mounts for one edit, so each opening starts from the
 * saved prices, not from an abandoned draft.
 */
function PriceForm({
  size,
  priceId,
  titleId,
  title,
  onClose,
  onSaved,
}: {
  size: VendorSize
  priceId: string
  titleId: string
  title: string
  onClose: () => void
  onSaved: () => void
}) {
  const [listPrice, setListPrice] = useState(String(size.listPrice ?? ''))
  const [salePrice, setSalePrice] = useState(String(size.salePrice ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const problemId = useId()
  const saleField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saleField.current?.focus()
  }, [])

  const list = Number(listPrice)
  const sale = Number(salePrice)
  const problem = priceProblem(sale, list)
  const changed = sale !== size.salePrice || list !== size.listPrice

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || problem || !changed) return
    setBusy(true)
    setError('')
    try {
      await vendorProductsService.updatePrice(priceId, { skuId: size.skuId, listPrice: list, salePrice: sale })
      onClose()
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the price'))
      setBusy(false)
    }
  }

  return (
    <form
      noValidate
      className="grid gap-3 p-3.5"
      aria-labelledby={titleId}
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || busy) return
        event.preventDefault()
        onClose()
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="font-display text-sm font-semibold">
          <span id={titleId}>{title}</span> price
        </p>
        {size.salePrice != null ? (
          <p className="vc-num text-xs text-[var(--md-muted)]">Now {formatCurrency(size.salePrice)}</p>
        ) : null}
      </div>

      {/* The selling price comes first: it is what customers pay and what changes most. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[9rem_9rem_minmax(0,1fr)] sm:items-end">
        <PriceField
          label="Selling price"
          inputRef={saleField}
          value={salePrice}
          disabled={busy}
          invalid={problem?.field === 'sale'}
          describedBy={problemId}
          onChange={setSalePrice}
        />
        <PriceField
          label="MRP"
          value={listPrice}
          disabled={busy}
          invalid={problem?.field === 'list'}
          describedBy={problemId}
          onChange={setListPrice}
        />
        <div className="col-span-2 sm:col-span-1">
          <PriceResult problem={problem?.message ?? null} problemId={problemId} sale={sale} list={list} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[0.8125rem] leading-5 text-[var(--md-danger)]">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full bg-white max-sm:h-11 sm:px-4"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="rounded-full max-sm:h-11 sm:px-5"
          pending={busy}
          disabled={busy || Boolean(problem) || !changed}
        >
          Save price
        </Button>
      </div>
    </form>
  )
}

/**
 * One size of a product on its rate card: what it is, what it sells for against its MRP, and
 * the way to change that. A phone stacks the prices under the size; from `sm` size, selling
 * price and MRP each hold a column, so they line up down the list.
 */
export function SizePriceRow({ size, onSaved }: { size: VendorSize; onSaved: () => void }) {
  const nameId = useId()
  const [editing, setEditing] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  const name = size.size ?? 'Standard'
  const off = percentOff(size.salePrice, size.listPrice)
  const { priceId } = size

  // The button comes back when the form closes, and takes focus back with it.
  useEffect(() => {
    if (!editing && wasEditing.current) opener.current?.focus()
    wasEditing.current = editing
  }, [editing])

  if (editing && priceId) {
    return (
      <li className="m-1.5 rounded-lg border-t-0 bg-white shadow-[var(--vc-shadow-lift)] ring-1 ring-[var(--vc-tint-line)]">
        <PriceForm
          size={size}
          priceId={priceId}
          titleId={nameId}
          title={name}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      </li>
    )
  }

  return (
    <li className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3.5 py-3 sm:grid-cols-[minmax(0,8rem)_5rem_minmax(0,1fr)_auto] sm:gap-x-4">
      <div className="flex flex-wrap items-center gap-2">
        <span id={nameId} className="text-sm font-semibold">
          {name}
        </span>
        {!size.active ? <Badge tone="neutral">Hidden</Badge> : null}
      </div>
      <div className="vc-num col-start-1 flex flex-wrap items-baseline gap-x-2 sm:contents">
        <p className="text-base font-bold sm:col-start-2">
          {size.salePrice != null ? formatCurrency(size.salePrice) : '—'}
        </p>
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--md-muted)] sm:col-start-3">
          {size.listPrice == null ? null : size.listPrice === size.salePrice ? (
            <span>At MRP</span>
          ) : (
            // Says which of the two figures is the MRP; a bare struck-through number does not.
            <span>
              MRP <s>{formatCurrency(size.listPrice)}</s>
            </span>
          )}
          {off ? <span className="font-semibold text-[var(--vc-tint-ink)]">{off}% off</span> : null}
        </p>
      </div>
      <div className="col-start-2 row-span-2 row-start-1 justify-self-end sm:col-start-4 sm:row-span-1">
        {/*
          A size with no price record cannot be repriced: the write is addressed to the price
          id, not the SKU. Offering the control would produce a request with nowhere to go.
        */}
        {priceId ? (
          // Stretched over its row, so a press anywhere on the row edits this price. The shared
          // press nudge is off: any translate would shrink the stretch to the button mid-press.
          <Button
            ref={opener}
            size="sm"
            variant="outline"
            className="rounded-full bg-white after:absolute after:inset-0 active:translate-none! max-sm:h-11 sm:px-4"
            aria-describedby={nameId}
            onClick={() => setEditing(true)}
          >
            <PencilIcon className="size-4" aria-hidden />
            Edit price
          </Button>
        ) : (
          <span className="text-xs text-[var(--md-muted)]">No price record</span>
        )}
      </div>
    </li>
  )
}
