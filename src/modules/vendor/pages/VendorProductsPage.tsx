import { ChevronDownIcon, PencilIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { createToastManager, Toaster } from '@/components/ui/toast'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { ProductDetailsEditor, type EditedProduct } from '@/modules/vendor/components/ProductDetailsEditor'
import { ProductPhotoThumb } from '@/modules/vendor/components/ProductPhoto'
import { RowSkeleton } from '@/modules/vendor/components/RowSkeleton'
import { SizePriceRow } from '@/modules/vendor/components/SizePriceRow'
import { useProductPhoto } from '@/modules/vendor/hooks/use-product-photo'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { groupByProduct } from '@/modules/vendor/lib/product-groups'
import type { VendorSize } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorProductsService } from '@/shared/api'
import { Badge, Button, LoadError, Spinner } from '@/shared/components'
import { cn, formatCurrency } from '@/shared/lib/utils'

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

/**
 * One product: its photo, what it is called, how many sizes it comes in, what it starts
 * at — and, opened up beneath that, its photo control and each size and its price.
 *
 * The page keeps one product open at a time. Closed sizes stay mounted, so a price edit
 * left half-typed survives opening another product.
 *
 * The reference shows only the summary line, because its catalog is a demo fixture nobody
 * can edit. Repricing is real here and it happens per size, so the sizes stay on the row
 * rather than behind a screen a vendor has to find. Products are ruled rows in the one
 * catalog panel rather than cards inside it.
 */
function ProductGroup({
  vendorId,
  productId,
  name,
  sizes,
  open,
  onToggle,
  onSaved,
  onEditDetails,
}: {
  vendorId: string
  productId: string | null
  name: string
  sizes: VendorSize[]
  open: boolean
  onToggle: () => void
  /** A price was saved; says which product and size, for the confirmation. */
  onSaved: (repriced: string) => void
  onEditDetails: (product: EditedProduct) => void
}) {
  const from = fromPrice(sizes)
  const sizesId = useId()
  const { photo, showUploaded } = useProductPhoto(vendorId, productId)
  const hasPhoto = photo.status === 'ready' && photo.url !== null
  const sizeCount = `${sizes.length} ${sizes.length === 1 ? 'size' : 'sizes'}`

  function editDetails() {
    if (!productId) return
    onEditDetails({
      vendorProductId: productId,
      name,
      photoUrl: photo.status === 'ready' ? photo.url : undefined,
      onPhotoSaved: showUploaded,
    })
  }

  return (
    <li>
      {/*
        What the product is, then what can be done with it, in that order at every width. A
        phone gives the two actions their own line as wide, labelled buttons, which puts the
        sizes right under the button that opens them; from `sm` they sit at the row's end.

        The sizes toggle stretches over this whole block, so a press anywhere on it opens the
        sizes. The photo and Edit details sit above that.
      */}
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:py-3.5">
        {/* Details are addressed to the vendor product id; a size without one has nothing to edit. */}
        {productId ? (
          <button
            type="button"
            onClick={editDetails}
            aria-label={hasPhoto ? `Change the photo of ${name}` : `Add a photo of ${name}`}
            className="relative z-10 rounded-xl transition-shadow hover:shadow-[var(--vc-shadow-lift)] focus-visible:ring-2 focus-visible:ring-[var(--md-green-500)] focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
          >
            <ProductPhotoThumb photo={photo} />
          </button>
        ) : (
          <ProductPhotoThumb photo={photo} />
        )}
        <div className="min-w-0">
          <span className="font-display block leading-snug font-semibold [overflow-wrap:anywhere]">{name}</span>
          <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2.5 gap-y-1">
            {from ? (
              <span className="vc-num text-sm font-bold whitespace-nowrap text-[var(--vc-tint-ink)]">{from}</span>
            ) : null}
            {photo.status === 'ready' && !photo.url ? <Badge tone="warning">Needs photo</Badge> : null}
          </div>
        </div>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          {productId ? (
            <Button
              size="sm"
              variant="outline"
              className="relative z-10 flex-1 rounded-full bg-white max-sm:h-11 sm:flex-none sm:px-4"
              aria-label={`Edit details of ${name}`}
              onClick={editDetails}
            >
              <PencilIcon className="size-4" aria-hidden />
              Edit details
            </Button>
          ) : null}
          {/* A fixed width from `sm`, so "1 size" and "12 sizes" leave the buttons in line
              down the list. */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={sizesId}
            aria-label={`${name}, ${sizeCount}`}
            className={cn(
              'vc-num inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-[var(--md-green-500)] focus-visible:ring-offset-2 motion-reduce:transition-none max-sm:h-11 sm:w-28 sm:flex-none',
              open
                ? 'border-[var(--vc-tint-line)] bg-[var(--vc-tint)] text-[var(--vc-tint-ink)]'
                : 'border-[var(--md-border)] bg-white hover:border-[var(--vc-tint-line)] hover:bg-emerald-50 hover:text-[var(--vc-tint-ink)]',
            )}
          >
            {sizeCount}
            <ChevronDownIcon
              className={cn('size-4 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <div id={sizesId} hidden={!open}>
        {/* An inset under the product's name, so the sizes read as part of that row. */}
        <ul className="vc-rows mb-3.5 rounded-xl bg-slate-50 sm:ml-[4.5rem]">
          {sizes.map((size) => (
            <SizePriceRow
              key={size.skuId}
              size={size}
              onSaved={() => onSaved(`${name}, ${size.size ?? 'Standard'}`)}
            />
          ))}
        </ul>
      </div>
    </li>
  )
}

const PRODUCTS_PER_PAGE = 6

export function VendorProductsPage() {
  const { vendorId } = useVendorAccount()
  const [sizes, setSizes] = useState<VendorSize[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [openProductId, setOpenProductId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<EditedProduct | null>(null)
  const [toasts] = useState(() => createToastManager())

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const confirmSaved = (title: string) => {
    toasts.add({ title, type: 'success', timeout: 3000, priority: 'low' })
  }

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

  const groups = groupByProduct(sizes ?? [])
  const totalPages = Math.max(1, Math.ceil(groups.length / PRODUCTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages - 1)
  const visible = groups.slice(currentPage * PRODUCTS_PER_PAGE, (currentPage + 1) * PRODUCTS_PER_PAGE)

  return (
    <>
      <DashboardPanel
        title="Your catalog"
        action={
          <div className="flex items-center gap-3">
            {loading && sizes !== null ? <Spinner label="Updating products" /> : null}
            <Button asChild size="sm" variant="outline" className="rounded-full bg-white max-sm:h-11">
              <Link to="/onboarding">Edit in setup</Link>
            </Button>
          </div>
        }
      >
        {sizes === null ? (
          error ? (
            <LoadError onRetry={reload} />
          ) : (
            <RowSkeleton
              label="Loading products"
              rowClassName="h-[8.375rem] rounded-xl sm:h-[5.25rem]"
              className="gap-2.5"
            />
          )
        ) : (
          <>
            {error ? <LoadError onRetry={reload} className="mb-4" /> : null}

            <div
              aria-busy={loading || undefined}
              className={cn('transition-opacity motion-reduce:transition-none', loading && 'opacity-60')}
            >
              {!groups.length ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--md-muted)]">
                  <span className="mb-1 block font-semibold text-[var(--md-ink)]">Nothing listed yet</span>
                  Products and their sizes are added during store setup.
                </p>
              ) : (
                <ul className="vc-rows -mb-3.5 border-t border-[var(--vc-edge)]">
                  {visible.map((group) => (
                    <ProductGroup
                      key={group.id}
                      vendorId={vendorId}
                      productId={group.productId}
                      name={group.name}
                      sizes={group.sizes}
                      open={openProductId === group.id}
                      onToggle={() => setOpenProductId((id) => (id === group.id ? null : group.id))}
                      onSaved={(repriced) => {
                        reload()
                        confirmSaved(`${repriced} price saved.`)
                      }}
                      onEditDetails={setEditing}
                    />
                  ))}
                </ul>
              )}
            </div>

            {totalPages > 1 ? (
              <div className="mt-3.5 flex items-center justify-between border-t border-[var(--vc-edge)] pt-3.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full bg-white max-sm:h-11"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="vc-num text-sm text-[var(--md-muted)]">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full bg-white max-sm:h-11"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DashboardPanel>
      <ProductDetailsEditor
        vendorId={vendorId}
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={(name) => {
          setEditing(null)
          confirmSaved(`${name} details saved.`)
        }}
      />
      <Toaster toastManager={toasts} limit={1} />
    </>
  )
}
