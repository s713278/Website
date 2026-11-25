import { ImageOffIcon, ImagePlusIcon, Undo2Icon } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import type { ProductPhoto } from '@/modules/vendor/hooks/use-product-photo'
import { PRODUCT_PHOTO_ACCEPT, productPhotoSelectionError } from '@/modules/vendor/lib/product-photo'
import { Button, Skeleton } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/** The small square on a product row: the shop's photo, or a quiet empty frame. */
export function ProductPhotoThumb({ photo }: { photo: ProductPhoto }) {
  const frame = 'size-12 shrink-0 overflow-hidden rounded-lg'
  if (photo.status === 'loading') return <Skeleton className={frame} />
  if (photo.status === 'ready' && photo.url) {
    return <img src={photo.url} alt="" width={48} height={48} className={cn(frame, 'bg-white object-cover ring-1 ring-[var(--vc-edge)]')} />
  }
  const Icon = photo.status === 'failed' ? ImageOffIcon : ImagePlusIcon
  return (
    <span
      aria-hidden
      className={cn(frame, 'grid place-items-center border border-dashed border-[var(--vc-tint-line)] bg-white text-[var(--md-muted)]')}
    >
      <Icon className="size-5" />
    </span>
  )
}

/** A file the vendor picked in the editor, previewed but not uploaded until Save. */
export type PickedPhoto = { file: File; url: string }

/**
 * The editor's photo: the shop's current photo, or a picked file previewed in its place.
 * Picking only previews; the editor uploads on Save. A wrong type or size is refused here.
 *
 * There is no remove: the backend has no endpoint to delete a product photo yet.
 */
export function ProductPhotoField({
  productName,
  currentUrl,
  picked,
  disabled,
  onPick,
  onUndo,
}: {
  productName: string
  /** The shop's own saved photo, or null when it has none. */
  currentUrl: string | null
  picked: PickedPhoto | null
  disabled: boolean
  onPick: (photo: PickedPhoto) => void
  onUndo: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const hintId = useId()
  const statusId = useId()

  function choose(file: File | undefined) {
    if (!file || disabled) return
    const invalid = productPhotoSelectionError(file)
    setError(invalid ?? '')
    if (!invalid) onPick({ file, url: URL.createObjectURL(file) })
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  const shown = picked?.url ?? currentUrl
  const status = picked
    ? 'New photo. It is uploaded when you save.'
    : currentUrl
      ? 'Your photo. Customers see it on your shop.'
      : 'No photo of your own yet. Customers see the catalog photo, if there is one.'

  return (
    <section aria-labelledby={`${hintId}-title`} className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={disabled}
        aria-label={shown ? `Change the photo of ${productName}` : `Add a photo of ${productName}`}
        aria-describedby={`${statusId} ${hintId}`}
        className={cn(
          'group relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl transition-[box-shadow,background-color] motion-reduce:transition-none sm:size-32',
          'focus-visible:ring-2 focus-visible:ring-[var(--md-green-500)] focus-visible:ring-offset-2 focus-visible:outline-none',
          shown
            ? 'bg-slate-50 ring-1 ring-[var(--vc-edge)]'
            : 'border-2 border-dashed border-[var(--vc-tint-line)] bg-[var(--vc-rail-bg)] text-[var(--vc-tint-ink)]',
          !disabled && 'cursor-pointer hover:shadow-[var(--vc-shadow-lift)]',
          dragging && 'bg-[var(--vc-tint)] ring-2 ring-[var(--md-green-500)]',
        )}
      >
        {shown ? (
          <>
            <img src={shown} alt="" className="size-full object-cover" />
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-slate-950/55 py-1 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            >
              Change
            </span>
          </>
        ) : (
          <span className="grid justify-items-center gap-1.5 text-sm font-semibold">
            <ImagePlusIcon className="size-7" aria-hidden />
            Add photo
          </span>
        )}
        {picked ? (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--vc-tint-ink)] shadow-sm">
            Not saved
          </span>
        ) : null}
      </button>

      <div className="grid min-w-0 flex-1 gap-2">
        <div>
          <h3 id={`${hintId}-title`} className="font-display text-sm font-semibold">
            Photo
          </h3>
          <p id={statusId} className="mt-1 text-sm text-[var(--md-ink)]">
            {status}
          </p>
          <p id={hintId} className="mt-1 max-w-[60ch] text-xs text-[var(--md-muted)]">
            Square photos look best. JPEG, PNG, WebP or GIF, up to 3 MB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {shown ? 'Choose another' : 'Choose photo'}
          </Button>
          {picked ? (
            <Button size="sm" variant="ghost" className="rounded-full" disabled={disabled} onClick={onUndo}>
              <Undo2Icon aria-hidden />
              {currentUrl ? 'Keep current photo' : 'Remove'}
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="max-w-[60ch] text-sm text-[var(--md-danger)]">
            {error}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PRODUCT_PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared so choosing the same file again still fires a change.
          event.target.value = ''
          choose(file)
        }}
      />
    </section>
  )
}
