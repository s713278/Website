import { useCallback, useEffect, useState } from 'react'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorSize } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorProductsService } from '@/shared/api'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/** Sizes arrive flat; a vendor thinks in products, so they are grouped back up. */
function groupByProduct(sizes: VendorSize[]) {
  const groups = new Map<string, { name: string; sizes: VendorSize[] }>()
  for (const size of sizes) {
    const key = size.productId ?? `sku-${size.skuId}`
    const group = groups.get(key) ?? { name: size.name, sizes: [] }
    group.sizes.push(size)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([id, group]) => ({ id, ...group }))
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
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
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
    <div className="w-full rounded-lg border border-[var(--vc-edge)] bg-slate-50/60 p-4">
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
        <Button size="sm" disabled={busy || invalid} onClick={() => void save()}>
          Save price
        </Button>
      </div>
    </div>
  )
}

export function VendorProductsPage() {
  const { vendorId } = useVendorAccount()
  const [sizes, setSizes] = useState<VendorSize[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

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

  return (
    <div>
      <PageHeader title="Products" subtitle="What you sell, and what each size costs" />
      {error ? <p className="mb-6 max-w-[68ch] text-sm text-[var(--md-danger)]">{error}</p> : null}

      {!groups.length ? (
        <EmptyState
          title="Nothing listed yet"
          description="Products and their sizes are added during store setup."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.id} className="max-w-3xl p-0">
              <h2 className="font-display border-b border-[var(--vc-rule)] px-5 py-3.5 font-semibold">
                {group.name}
              </h2>
              {/*
                Size, then price, then the control — three columns rather than a left-stacked
                block, because a vendor checking their prices is comparing one size against
                the next and a ragged price column defeats that.
              */}
              <ul className="vc-rows">
                {group.sizes.map((size) => (
                  <li
                    key={size.skuId}
                    className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5"
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
                    <PriceEditor size={size} onSaved={reload} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
