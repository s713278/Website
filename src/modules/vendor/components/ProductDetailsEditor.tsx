import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/modules/vendor/components/ConfirmDialog'
import { ProductPhotoField, type PickedPhoto } from '@/modules/vendor/components/ProductPhoto'
import { RowSkeleton } from '@/modules/vendor/components/RowSkeleton'
import { useMediaQuery } from '@/modules/vendor/hooks/use-media-query'
import { checkFeatures, featureLabelKey, type FeatureRowError } from '@/modules/vendor/lib/product-features'
import type { ProductFeature, VendorProductDetails } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorImagesService, vendorProductsService } from '@/shared/api'
import { Button, Label, LoadError, ShadcnInput } from '@/shared/components'

/** The vendor product being edited, as its list row knows it. */
export type EditedProduct = {
  vendorProductId: string
  name: string
  /** The row's photo once read: a URL, or null for none. Undefined while the row is still reading it. */
  photoUrl: string | null | undefined
  /** Shows a newly saved photo on the row. */
  onPhotoSaved: (url: string) => void
}

/** A product feature being edited; `id` keeps each row's inputs stable while rows come and go. */
type FeatureRow = ProductFeature & { id: number }

let nextFeatureRowId = 0

/** Sample labels offered as chips, each with an example for its Detail placeholder. */
const FEATURE_SAMPLES = [
  { label: 'Brand', example: 'Your brand name' },
  { label: 'Easily Digestible', example: 'Light on the stomach' },
  { label: 'Health Benefits', example: 'Rich in fibre' },
  { label: 'How to Use', example: 'Best within 3 days of opening' },
  { label: 'Ingredients', example: 'List the main ingredients' },
  { label: 'Made in', example: 'Mysuru, Karnataka' },
  { label: 'Good for', example: 'Breakfast and evening snacks' },
]

function detailPlaceholder(label: string): string {
  const sample = FEATURE_SAMPLES.find((item) => featureLabelKey(item.label) === featureLabelKey(label))
  return `e.g. ${sample ? sample.example : '500 g'}`
}

function toRows(features: ProductFeature[]): FeatureRow[] {
  return features.map(({ label, detail }) => ({ id: nextFeatureRowId++, label, detail }))
}

function sameFeatures(rows: ProductFeature[], loaded: ProductFeature[]): boolean {
  return (
    rows.length === loaded.length &&
    rows.every((row, i) => row.label === loaded[i].label && row.detail === loaded[i].detail)
  )
}

/** Names what failed to save, for the message after the photo itself did save. */
function textParts(description: boolean, features: boolean): string {
  if (description && features) return 'the description and features are'
  return description ? 'the description is' : 'the features are'
}

/**
 * The product features section: Label/Detail rows in the vendor's order. Each row's problem, once
 * shown, sits under the row and is tied to the input it names.
 */
function ProductFeaturesField({
  rows,
  errors,
  tooLong,
  blockedSaves,
  disabled,
  onChange,
}: {
  rows: FeatureRow[]
  /** Per row, its problem to show; empty until a save has been tried. */
  errors: (FeatureRowError | undefined)[]
  /** Shows the size-limit message; false until a save has been tried. */
  tooLong: boolean
  /** How many saves the problems have blocked; each new one moves focus to the first problem. */
  blockedSaves: number
  disabled: boolean
  onChange: (rows: FeatureRow[]) => void
}) {
  const headingId = useId()
  const helpId = useId()
  const inputId = useId()
  const samplesId = useId()
  // The control to focus once its row has rendered. An object, so asking for the same id again
  // (two removals that both land on Add row) still moves focus.
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null)
  const usedLabels = new Set(rows.map((row) => featureLabelKey(row.label)))
  const samples = FEATURE_SAMPLES.filter((sample) => !usedLabels.has(featureLabelKey(sample.label)))

  useEffect(() => {
    if (focusTarget) document.getElementById(focusTarget.id)?.focus()
  }, [focusTarget])

  useEffect(() => {
    if (!blockedSaves) return
    const firstInvalid = document.getElementById(`${inputId}-rows`)?.querySelector<HTMLElement>('[aria-invalid="true"]')
    // A save blocked only by size has no input to blame, so the size message takes focus.
    ;(firstInvalid ?? document.getElementById(`${inputId}-size`))?.focus()
    // Keyed on blocked saves only, so edits made while errors show do not pull focus.
  }, [blockedSaves, inputId])

  function edit(id: number, change: Partial<ProductFeature>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...change } : row)))
  }

  function add(label: string, focus: 'label' | 'detail') {
    const [row] = toRows([{ label, detail: '' }])
    onChange([...rows, row])
    setFocusTarget({ id: `${inputId}-${row.id}-${focus}` })
  }

  function remove(index: number) {
    // Focus moves to the row that takes this one's place, else the one before, else Add row.
    const neighbour = rows[index + 1] ?? rows[index - 1]
    onChange(rows.filter((_, i) => i !== index))
    setFocusTarget({ id: neighbour ? `${inputId}-${neighbour.id}-remove` : `${inputId}-add` })
  }

  return (
    <section className="grid gap-3" aria-labelledby={headingId} aria-describedby={helpId}>
      <div className="grid gap-1">
        <h3 id={headingId} className="font-display text-sm font-semibold">
          Product features
        </h3>
        <p id={helpId} className="max-w-[60ch] text-xs text-[var(--md-muted)]">
          Each feature is a label and a detail, such as Brand: Nandini. Remove every feature to show
          the catalog features instead.
        </p>
      </div>

      {samples.length ? (
        <div className="grid gap-1.5">
          <p id={samplesId} className="text-xs font-medium text-[var(--md-muted)]">
            Samples
          </p>
          <ul className="flex flex-wrap gap-2" aria-labelledby={samplesId}>
            {samples.map((sample) => (
              <li key={sample.label}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  disabled={disabled}
                  aria-label={`Add ${sample.label}`}
                  onClick={() => add(sample.label, 'detail')}
                >
                  <PlusIcon aria-hidden />
                  {sample.label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length ? (
        <div className="grid gap-1.5">
          <div
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2.5rem] gap-2 text-xs font-medium text-[var(--md-muted)]"
            aria-hidden
          >
            <span>Label</span>
            <span>Detail</span>
          </div>
          <ol id={`${inputId}-rows`} className="grid gap-2">
            {rows.map((row, index) => {
              const error = errors[index]
              const errorId = `${inputId}-${row.id}-error`
              const invalid = (field: FeatureRowError['field']) =>
                error?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}
              return (
              <li key={row.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2.5rem] items-center gap-x-2 gap-y-1">
                <ShadcnInput
                  id={`${inputId}-${row.id}-label`}
                  {...invalid('label')}
                  value={row.label}
                  disabled={disabled}
                  data-vaul-no-drag
                  aria-label={`Feature label ${index + 1}`}
                  placeholder="e.g. Pack size"
                  className="h-10 rounded-xl"
                  onChange={(event) => edit(row.id, { label: event.target.value })}
                />
                <ShadcnInput
                  id={`${inputId}-${row.id}-detail`}
                  {...invalid('detail')}
                  value={row.detail}
                  disabled={disabled}
                  data-vaul-no-drag
                  aria-label={`Feature detail ${index + 1}`}
                  placeholder={detailPlaceholder(row.label)}
                  className="h-10 rounded-xl"
                  onChange={(event) => edit(row.id, { detail: event.target.value })}
                />
                <Button
                  id={`${inputId}-${row.id}-remove`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-10 rounded-full px-0 text-[var(--md-muted)]"
                  disabled={disabled}
                  aria-label={`Remove feature ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
                {error ? (
                  <p id={errorId} className="col-span-full text-xs text-[var(--md-danger)]">
                    {error.message}
                  </p>
                ) : null}
              </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      {tooLong ? (
        <p id={`${inputId}-size`} tabIndex={-1} className="text-xs text-[var(--md-danger)] outline-none">
          Your features are too long to save. Shorten some details, then save again.
        </p>
      ) : null}

      <Button
        id={`${inputId}-add`}
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start rounded-xl border-[var(--vc-tint-line)] bg-white px-3.5 font-semibold text-[var(--vc-tint-ink)] hover:bg-[var(--vc-tint)] hover:text-[var(--vc-tint-ink)]"
        disabled={disabled}
        onClick={() => add('', 'label')}
      >
        <PlusIcon aria-hidden />
        Add row
      </Button>
    </section>
  )
}

type Loaded =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; details: VendorProductDetails; photoUrl: string | null }

/**
 * The editor for one vendor product: its photo, product description and product features in one form with one
 * Save. Reads only what it was not given; closing unmounts it, which cancels a read in flight.
 */
function EditorBody({
  vendorId,
  product,
  cached,
  onLoaded,
  onSavingChange,
  onDirtyChange,
  onSaved,
}: {
  vendorId: string
  product: EditedProduct
  /** Details read on an earlier open, shown without reading again. */
  cached: VendorProductDetails | undefined
  onLoaded: (vendorProductId: string, details: VendorProductDetails) => void
  onSavingChange: (saving: boolean) => void
  /** Whether the editor holds changes not yet saved. */
  onDirtyChange: (dirty: boolean) => void
  onSaved: (result: { textSaved: boolean }) => void
}) {
  const { vendorProductId, name, onPhotoSaved } = product
  // Taken once: what this mount was handed. A retry reads everything fresh.
  const [given] = useState(() => ({ details: cached, photoUrl: product.photoUrl }))
  const [loaded, setLoaded] = useState<Loaded>(
    given.details && given.photoUrl !== undefined
      ? { status: 'ready', details: given.details, photoUrl: given.photoUrl }
      : { status: 'loading' },
  )
  const [retryToken, setRetryToken] = useState(0)
  const [description, setDescription] = useState(given.details?.description ?? '')
  const [features, setFeatures] = useState(() => toRows(given.details?.features ?? []))
  const [picked, setPicked] = useState<PickedPhoto | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Saves blocked by feature problems: none yet hides them; each new one moves focus to them.
  const [blockedSaves, setBlockedSaves] = useState(0)
  const descriptionId = useId()
  const descriptionHelpId = useId()

  useEffect(() => {
    const first = retryToken === 0
    if (first && given.details && given.photoUrl !== undefined) return
    let cancelled = false
    const controller = new AbortController()
    const { signal } = controller
    setLoaded({ status: 'loading' })

    Promise.all([
      first && given.details
        ? given.details
        : vendorProductsService.getProductDetails(vendorId, vendorProductId, { signal }),
      first && given.photoUrl !== undefined
        ? given.photoUrl
        : vendorImagesService.getProductImage(vendorId, vendorProductId, { signal }),
    ])
      .then(([details, photoUrl]) => {
        if (cancelled) return
        onLoaded(vendorProductId, details)
        setLoaded({ status: 'ready', details, photoUrl })
        setDescription(details.description)
        setFeatures(toRows(details.features))
      })
      .catch(() => {
        if (!cancelled) setLoaded({ status: 'failed' })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [vendorId, vendorProductId, retryToken, given, onLoaded])

  // A picked photo's preview URL is released when it is replaced, undone, saved, or the editor closes.
  useEffect(() => (picked ? () => URL.revokeObjectURL(picked.url) : undefined), [picked])

  useEffect(() => onSavingChange(saving), [saving, onSavingChange])

  const ready = loaded.status === 'ready'
  // Only a changed part is sent: the read may have fallen back to the catalog default, and
  // sending it back unchanged would make that text the shop's own.
  const descriptionChanged = ready && description !== loaded.details.description
  // Compared as they would be sent: untouched rows, including list-shaped ones, are never sent,
  // and an empty row or added spaces are no change.
  const featureCheck = checkFeatures(features)
  const featuresChanged =
    ready && !sameFeatures(featureCheck.features, checkFeatures(loaded.details.features).features)
  const changed = descriptionChanged || featuresChanged || picked !== null
  useEffect(() => onDirtyChange(changed), [changed, onDirtyChange])

  // Feature problems show once a save has been tried, then follow the vendor's edits.
  const featuresBlocked = featuresChanged && !featureCheck.ok
  const showFeatureErrors = blockedSaves > 0 && featuresChanged
  const shownFeatureErrors = showFeatureErrors ? featureCheck.rowErrors : []

  async function save() {
    if (!changed || loaded.status !== 'ready') return
    setSaveError('')
    // Checked before anything is sent, so a photo is not uploaded for a save that cannot finish.
    if (featuresBlocked) {
      setBlockedSaves((count) => count + 1)
      return
    }
    setSaving(true)
    let photoSaved = false

    if (picked) {
      try {
        const url = await vendorImagesService.uploadProductImage(vendorId, vendorProductId, picked.file)
        photoSaved = true
        onPhotoSaved(url)
        // Now the current photo, so a retry after a failed description does not upload it again.
        setLoaded({ ...loaded, photoUrl: url })
        setPicked(null)
      } catch (err) {
        setSaveError(`Your photo did not save. ${getErrorMessage(err, 'Could not upload this photo.')}`)
        setSaving(false)
        return
      }
    }

    const textChanged = descriptionChanged || featuresChanged
    if (textChanged) {
      try {
        await vendorProductsService.updateProductDetails(vendorId, vendorProductId, {
          ...(descriptionChanged ? { description } : {}),
          ...(featuresChanged ? { features: featureCheck.features } : {}),
        })
      } catch (err) {
        const message = getErrorMessage(err, 'Could not save the description or features.')
        const failed = textParts(descriptionChanged, featuresChanged)
        setSaveError(photoSaved ? `Your photo is saved, but ${failed} not. ${message}` : message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved({ textSaved: textChanged })
  }

  return (
    <>
      <header className="flex items-start gap-3 px-5 pt-3 pb-3 sm:pt-5">
        <div className="min-w-0 flex-1">
          <DrawerTitle className="truncate text-xl">{name}</DrawerTitle>
          <DrawerDescription className="mt-0.5 text-sm text-[var(--md-muted)]">
            The photo and description customers see on your shop.
          </DrawerDescription>
        </div>
        <DrawerClose asChild>
          <Button variant="ghost" size="sm" className="-mr-2 rounded-full" aria-label="Close" disabled={saving}>
            <XIcon aria-hidden />
          </Button>
        </DrawerClose>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {loaded.status === 'loading' ? (
          <RowSkeleton label="Loading product details" rows={2} rowClassName="h-32 rounded-2xl" />
        ) : loaded.status === 'failed' ? (
          <LoadError
            message="Could not load this product's details."
            onRetry={() => setRetryToken((token) => token + 1)}
          />
        ) : (
          <div className="grid gap-5 rounded-2xl border border-[var(--vc-edge)] bg-white p-4 sm:p-5">
            <ProductPhotoField
              productName={name}
              currentUrl={loaded.photoUrl}
              picked={picked}
              disabled={saving}
              onPick={setPicked}
              onUndo={() => setPicked(null)}
            />

            <div className="h-px bg-[var(--vc-rule)]" aria-hidden />

            <section className="grid gap-1.5">
              <Label htmlFor={descriptionId} className="font-display text-sm font-semibold">
                Product description
              </Label>
              <Textarea
                id={descriptionId}
                rows={5}
                value={description}
                disabled={saving}
                data-vaul-no-drag
                aria-describedby={descriptionHelpId}
                placeholder="What makes this product worth buying from your shop? Freshness, source, how it is packed."
                className="resize-y rounded-xl"
                onChange={(event) => setDescription(event.target.value)}
              />
              <p id={descriptionHelpId} className="max-w-[60ch] text-xs text-[var(--md-muted)]">
                Leave this empty to show the catalog description instead.
              </p>
            </section>

            <div className="h-px bg-[var(--vc-rule)]" aria-hidden />

            <ProductFeaturesField
              rows={features}
              errors={shownFeatureErrors}
              tooLong={showFeatureErrors && featureCheck.tooLong}
              blockedSaves={blockedSaves}
              disabled={saving}
              onChange={setFeatures}
            />
          </div>
        )}
      </div>

      <footer className="grid gap-2 border-t border-[var(--vc-rule)] bg-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {saveError || (blockedSaves > 0 && featuresBlocked) ? (
          // Keyed by blocked saves, so a repeated blocked save is announced again.
          <p key={blockedSaves} role="alert" className="text-sm text-[var(--md-danger)]">
            {saveError || 'Fix the features above, then save again.'}
          </p>
        ) : null}
        <div className="flex items-center gap-2 sm:justify-end">
          <p className="mr-auto hidden text-xs text-[var(--md-muted)] sm:block">{changed ? 'Unsaved changes' : ''}</p>
          <DrawerClose asChild>
            <Button variant="secondary" className="hidden rounded-full sm:inline-flex" disabled={saving}>
              Cancel
            </Button>
          </DrawerClose>
          <Button
            className="h-11 w-full rounded-full sm:h-9 sm:w-auto sm:px-6"
            disabled={!changed || saving}
            pending={saving}
            onClick={() => void save()}
          >
            Save
          </Button>
        </div>
      </footer>
    </>
  )
}

/**
 * One editor for a vendor product's photo, description and features, in a drawer: on a phone it rises
 * from the bottom and can be swiped down to close; from tablet width it slides in from the
 * right, leaving the list in view. It cannot be dismissed while a save runs.
 */
export function ProductDetailsEditor({
  vendorId,
  product,
  onClose,
  onSaved,
}: {
  vendorId: string
  /** The product being edited, or null when the editor is closed. */
  product: EditedProduct | null
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const wide = useMediaQuery('(min-width: 640px)')
  // Details read this page visit, by vendor product id. Saved text drops its entry: a blank
  // description or an empty feature set shows the catalog default, which only the server knows.
  const [cache] = useState(() => new Map<string, VendorProductDetails>())
  // The last product stays rendered while the drawer animates closed, so it does not empty first.
  const [shown, setShown] = useState(product)
  if (product && product !== shown) setShown(product)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)
  // The control that opened the editor, which takes focus back on close. vaul has no trigger to
  // return it to, since the editor opens from the page's state.
  const opener = useRef<HTMLElement | null>(null)
  // What had focus in the editor when a close was asked for, which takes it back if the vendor keeps
  // editing; the editor itself when nothing inside had it, as after a tap outside.
  const askedFrom = useRef<HTMLElement | null>(null)
  const discarding = useRef(false)
  const remember = useCallback(
    (vendorProductId: string, details: VendorProductDetails) => cache.set(vendorProductId, details),
    [cache],
  )

  // Every way of closing lands here: the close button, Cancel, Escape, a tap outside and a swipe.
  function requestClose() {
    if (saving) return
    if (!dirty) {
      onClose()
      return
    }
    const focused = document.activeElement
    askedFrom.current = focused instanceof HTMLElement && sheet.current?.contains(focused) ? focused : null
    setConfirming(true)
    snapBack()
  }

  // A swipe that vaul took for a dismissal has moved the sheet and dimmed the overlay by hand;
  // staying open means undoing that. The sheet's own styles take it back with their transition; the
  // overlay has none, so it eases back to full instead of jumping there while the confirm rises.
  function snapBack() {
    const element = sheet.current
    if (!element) return
    element.style.removeProperty('transform')
    element.style.removeProperty('transition')
    const overlay = document.querySelector<HTMLElement>('[data-vaul-overlay]')
    if (!overlay?.style.opacity) return
    overlay.style.transition = 'opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
    overlay.style.opacity = '1'
    overlay.addEventListener(
      'transitionend',
      () => {
        overlay.style.removeProperty('opacity')
        overlay.style.removeProperty('transition')
      },
      { once: true },
    )
  }

  return (
    <>
      <Drawer
        open={product !== null}
        direction={wide ? 'right' : 'bottom'}
        dismissible={!saving}
        autoFocus
        onOpenChange={(open) => {
          if (!open) requestClose()
        }}
      >
        {/* Portalled to <body>, outside `.vendor-console`, so it brings the vendor tokens with it. */}
        <DrawerContent
          ref={sheet}
          className="vendor-portal-scope"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (opener.current?.isConnected) opener.current.focus()
          }}
        >
          {shown ? (
            <EditorBody
              key={shown.vendorProductId}
              vendorId={vendorId}
              product={shown}
              cached={cache.get(shown.vendorProductId)}
              onLoaded={remember}
              onSavingChange={setSaving}
              onDirtyChange={setDirty}
              onSaved={({ textSaved }) => {
                if (textSaved) cache.delete(shown.vendorProductId)
                onSaved(shown.name)
              }}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirming}
        title="Discard your changes?"
        description={`Your changes to ${shown?.name ?? 'this product'} are not saved.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        overSheet
        onConfirm={() => {
          discarding.current = true
          onClose()
        }}
        onOpenChange={setConfirming}
        onCloseAutoFocus={(event) => {
          // A discard leaves focus to the editor's own close, which returns it to the opener.
          if (discarding.current) {
            discarding.current = false
            return
          }
          event.preventDefault()
          const target = askedFrom.current?.isConnected ? askedFrom.current : sheet.current
          target?.focus()
        }}
      />
    </>
  )
}
