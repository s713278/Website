import { ChevronDownIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { groupByProduct } from '@/modules/vendor/lib/product-groups'
import type { VendorSize } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorProductsService } from '@/shared/api'
import { Badge, Button, Input, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/**
 * The cheapest way in to a product, as the shared design writes it: "From ₹189".
 *
 * Selling price, not MRP — it is what a customer pays. Withheld when no size carries one,
 * because a product priced from nothing is a product nobody can buy.
 */
function fromPrice(sizes: VendorSize[]): string | null {
  const prices = sizes
    .map((size) => size.salePrice)
    .filter((price): price is number => price != null)
  return prices.length ? `From ${formatCurrency(Math.min(...prices))}` : null
}

function PriceEditor({ size, onSaved }: { size: VendorSize; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [listPrice, setListPrice] = useState(String(size.listPrice ?? ''))
  const [salePrice, setSalePrice] = useState(String(size.salePrice ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /*
   * A size with no price record cannot be repriced: the write is addressed to the price
   * id, not the SKU. Offering the control would produce a request with nowhere to go.
   */
  if (!size.priceId) {
    return <span className="text-xs text-[var(--md-muted)]">No price record</span>
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        Edit price
      </Button>
    )
  }

  const list = Number(listPrice)
  const sale = Number(salePrice)
  const invalid =
    !Number.isFinite(list) || !Number.isFinite(sale) || list <= 0 || sale <= 0 || sale > list

  async function save() {
    setBusy(true)
    setError('')
    try {
      await vendorProductsService.updatePrice(size.priceId as string, {
        skuId: size.skuId,
        listPrice: list,
        salePrice: sale,
      })
      setOpen(false)
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the price'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full rounded-lg border border-[var(--vc-edge)] bg-white p-4">
      <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
        <Input
          label="MRP"
          inputMode="decimal"
          value={listPrice}
          onChange={(event) => setListPrice(event.target.value)}
        />
        <Input
          label="Selling price"
          inputMode="decimal"
          value={salePrice}
          onChange={(event) => setSalePrice(event.target.value)}
        />
      </div>
      {invalid ? (
        <p className="mt-2 max-w-[68ch] text-xs text-[var(--md-danger)]">
          Both prices must be above zero, and the selling price cannot exceed the MRP.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-[var(--md-danger)]">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" className="rounded-full" disabled={busy || invalid} onClick={() => void save()}>
          Save price
        </Button>
      </div>
    </div>
  )
}

/**
 * One product: what it is called, how many sizes it comes in, what it starts at — and,
 * opened up beneath that, each of those sizes and its price.
 *
 * The page keeps one product open at a time. Closed sizes stay mounted, so a price edit
 * left half-typed survives opening another product.
 *
 * The reference shows only the summary line, because its catalog is a demo fixture nobody
 * can edit. Repricing is real here and it happens per size, so the sizes stay on the row
 * rather than behind a screen a vendor has to find.
 */
function ProductGroup({
  name,
  sizes,
  open,
  onToggle,
  onSaved,
}: {
  name: string
  sizes: VendorSize[]
  open: boolean
  onToggle: () => void
  onSaved: () => void
}) {
  const from = fromPrice(sizes)
  const sizesId = useId()

  return (
    <li className="overflow-hidden rounded-lg border border-[var(--vc-edge)] bg-slate-50/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={sizesId}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-100/70"
      >
        <span className="min-w-0">
          <span className="block font-display font-semibold">{name}</span>
          <span className="vc-num mt-0.5 block text-xs text-[var(--md-muted)]">
            {sizes.length} {sizes.length === 1 ? 'size' : 'sizes'}
          </span>
        </span>
        <span className="flex items-center gap-3">
          {from ? (
            <span className="vc-num font-bold whitespace-nowrap text-[var(--vc-tint-ink)]">{from}</span>
          ) : null}
          <ChevronDownIcon
            className={`size-4 shrink-0 text-[var(--md-muted)] transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>

      {/*
        Size, then price, then the control — three columns rather than a left-stacked
        block, because a vendor checking their prices is comparing one size against the
        next and a ragged price column defeats that.
      */}
      <ul id={sizesId} hidden={!open} className="vc-rows border-t border-[var(--vc-rule)] bg-white">
        {sizes.map((size) => (
          <li
            key={size.skuId}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 px-3.5 py-3"
          >
            <div className="flex flex-wrap items-center gap-2 sm:w-40">
              <span className="text-sm font-medium">{size.size ?? 'Standard'}</span>
              {!size.active ? <Badge tone="neutral">Hidden</Badge> : null}
            </div>
            <p className="vc-num flex-1 text-sm">
              {size.salePrice != null ? formatCurrency(size.salePrice) : '—'}
              {size.listPrice != null && size.listPrice !== size.salePrice ? (
                <span className="ml-2 text-[var(--md-muted)] line-through">
                  {formatCurrency(size.listPrice)}
                </span>
              ) : null}
            </p>
            <PriceEditor size={size} onSaved={onSaved} />
          </li>
        ))}
      </ul>
    </li>
  )
}

const PRODUCTS_PER_PAGE = 5

export function VendorProductsPage() {
  const { vendorId } = useVendorAccount()
  const [sizes, setSizes] = useState<VendorSize[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [openProductId, setOpenProductId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setError('')

    void vendorProductsService
      .listSizes(vendorId, controller.signal)
      .then((data) => {
        if (!cancelled) setSizes(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your products'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [vendorId, reloadToken])

  if (loading) return <Spinner label="Loading products…" />

  const groups = groupByProduct(sizes)
  const totalPages = Math.max(1, Math.ceil(groups.length / PRODUCTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages - 1)
  const visible = groups.slice(currentPage * PRODUCTS_PER_PAGE, (currentPage + 1) * PRODUCTS_PER_PAGE)

  return (
    <DashboardPanel
      title="Your catalog"
      action={
        <Link to="/onboarding">
          <Button size="sm" variant="outline" className="rounded-full">
            Edit in setup
          </Button>
        </Link>
      }
    >
      {error ? (
        <p className="mb-4 max-w-[68ch] text-sm text-[var(--md-danger)]">{error}</p>
      ) : null}

      {!groups.length ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--md-muted)]">
          <span className="mb-1 block font-semibold text-[var(--md-ink)]">Nothing listed yet</span>
          Products and their sizes are added during store setup.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {visible.map((group) => (
            <ProductGroup
              key={group.id}
              name={group.name}
              sizes={group.sizes}
              open={openProductId === group.id}
              onToggle={() => setOpenProductId((id) => (id === group.id ? null : group.id))}
              onSaved={reload}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-[var(--vc-rule)] pt-4">
          <Button size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            Previous
          </Button>
          <span className="vc-num text-sm text-[var(--md-muted)]">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </DashboardPanel>
  )
}
