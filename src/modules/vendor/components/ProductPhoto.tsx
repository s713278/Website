import { CameraIcon, CheckIcon, ImageOffIcon, ImagePlusIcon, Undo2Icon } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import type { ProductPhoto } from '@/modules/vendor/hooks/use-product-photo'
import {
  EDITOR_HINT,
  EDITOR_TITLE,
  PHOTO_EMPTY,
  PHOTO_FILLED,
  PHOTO_FRAME,
  photoHint,
} from '@/modules/vendor/lib/product-editor-ui'
import { PRODUCT_PHOTO_ACCEPT, productPhotoSelectionError } from '@/modules/vendor/lib/product-photo'
import { Skeleton } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/** The small square on a product row: the shop's photo, or a quiet empty frame. */
export function ProductPhotoThumb({ photo }: { photo: ProductPhoto }) {
  const frame = 'block size-14 shrink-0 overflow-hidden rounded-xl'
  if (photo.status === 'loading') return <Skeleton className={frame} />
  if (photo.status === 'ready' && photo.url) {
    return <img src={photo.url} alt="" width={56} height={56} className={cn(frame, 'bg-white object-cover ring-1 ring-[var(--vc-edge)]')} />
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

/** A whole photo inside its box, which shimmers until the photo arrives. */
export function FramedPhoto({ src, alt }: { src: string; alt: string }) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (failedUrl === src) {
    return (
      <span className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-sm text-[var(--md-muted)]">
        <ImageOffIcon className="size-6" aria-hidden />
        Preview unavailable
      </span>
    )
  }

  const loaded = loadedUrl === src
  return (
    <>
      {loaded ? (
        // Fills whatever of the box the photo's own shape leaves over.
        <span
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center blur-xl brightness-90"
          style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
        />
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <img
        src={src}
        alt={alt}
        // An already cached photo is shown before the first paint, so it does not flash.
        ref={(image) => {
          if (image?.complete && image.naturalWidth) setLoadedUrl(src)
        }}
        className={cn('absolute inset-0 size-full object-contain', !loaded && 'opacity-0')}
        onLoad={() => setLoadedUrl(src)}
        onError={() => setFailedUrl(src)}
      />
    </>
  )
}

export function SavedPhotoStatus({ id }: { id?: string }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-[0.8125rem] leading-5 font-semibold text-[var(--md-green-700)]">
      <CheckIcon className="size-3.5" aria-hidden />
      Saved photo
    </p>
  )
}

/** A file the vendor picked in the editor, previewed but not uploaded until Save. */
export type PickedPhoto = { file: File; url: string }

/** The controls laid over a photo: white, so they read on any picture. */
const ON_PHOTO =
  'absolute bottom-3 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.28)]'

/**
 * The editor's photo: the shop's current photo, or a picked file previewed in its place. The
 * whole box chooses a file and takes a dropped one.
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
  const frameRef = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const titleId = useId()
  const statusId = useId()
  const hintId = useId()
  const errorId = useId()

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

  const describedBy = [statusId, hintId, error ? errorId : null].filter(Boolean).join(' ')
  const shown = picked?.url ?? currentUrl

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className={EDITOR_TITLE}>
        Photo
      </h3>

      {/* A dropped file lands on the frame. */}
      <div
        className="relative mt-3"
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(event) => {
          // Moving between the frame's own children is not leaving it.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <button
          ref={frameRef}
          type="button"
          disabled={disabled}
          aria-label={shown ? `Change the photo of ${productName}` : `Add a photo of ${productName}`}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            PHOTO_FRAME,
            'group relative block cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60',
            shown
              ? cn(PHOTO_FILLED, 'bg-slate-100')
              : cn(
                  PHOTO_EMPTY,
                  'border-2 border-dashed border-[var(--vc-tint-line)] bg-emerald-50/60 transition-colors enabled:hover:bg-emerald-50 motion-reduce:transition-none',
                ),
            dragging && 'ring-3 ring-[var(--md-green-600)]',
          )}
          onClick={() => inputRef.current?.click()}
        >
          {shown ? (
            <>
              <FramedPhoto src={shown} alt={picked ? 'New photo preview' : `Your photo of ${productName}`} />
              <span
                aria-hidden
                className={cn(ON_PHOTO, 'right-3 transition-colors group-enabled:group-hover:bg-emerald-50 motion-reduce:transition-none')}
              >
                <CameraIcon className="size-4" />
                Change photo
              </span>
            </>
          ) : (
            <span className="grid h-full place-content-center justify-items-center gap-1 px-5 text-center">
              <span className="font-display text-sm font-semibold">Add your own photo</span>
              <span id={statusId} className="max-w-[34ch] text-[0.8125rem] leading-5 text-[var(--md-muted)]">
                Until then, customers see the catalog photo, if there is one.
              </span>
              <span className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--md-green-700)] px-5 text-sm font-semibold text-white">
                <ImagePlusIcon className="size-4" aria-hidden />
                Choose photo
              </span>
            </span>
          )}
        </button>

        {/* Beside the frame's button, not inside it: a button cannot hold another. */}
        {picked ? (
          <button
            type="button"
            disabled={disabled}
            aria-label="Undo photo change"
            className={cn(
              ON_PHOTO,
              'left-3 cursor-pointer outline-none after:absolute after:-inset-1 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60',
            )}
            onClick={() => {
              setError('')
              onUndo()
              frameRef.current?.focus()
            }}
          >
            <Undo2Icon className="size-4" aria-hidden />
            Undo
          </button>
        ) : null}
      </div>

      <div className="mt-2.5 grid gap-0.5">
        {picked ? (
          // A long file name breaks wherever it must; the words after it stay whole.
          <p id={statusId} className="text-[0.8125rem] leading-5 font-semibold text-amber-800 [overflow-wrap:anywhere]">
            {picked.file.name} · Not&nbsp;saved&nbsp;yet
          </p>
        ) : currentUrl ? (
          <SavedPhotoStatus id={statusId} />
        ) : null}
        <p id={hintId} className={EDITOR_HINT}>
          {photoHint(Boolean(shown))}
        </p>
        {error ? (
          <p id={errorId} role="alert" className="mt-1 max-w-[60ch] text-[0.8125rem] leading-5 text-[var(--md-danger)]">
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
