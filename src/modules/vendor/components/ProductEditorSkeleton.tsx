import { FramedPhoto, SavedPhotoStatus } from '@/modules/vendor/components/ProductPhoto'
import {
  DESCRIPTION_HINT,
  EDITOR_BODY,
  EDITOR_HINT,
  EDITOR_TITLE,
  FEATURE_COLUMNS,
  FEATURE_TABLE,
  FEATURES_HINT,
  PHOTO_EMPTY,
  PHOTO_FILLED,
  PHOTO_FRAME,
  photoHint,
} from '@/modules/vendor/lib/product-editor-ui'
import { Skeleton } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/** Uneven widths, so the two placeholder rows read as two different facts. */
const FEATURE_ROWS = [
  { label: 'w-16', detail: 'w-32' },
  { label: 'w-20', detail: 'w-40' },
]

function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid gap-0.5">
      <h3 className={EDITOR_TITLE}>{title}</h3>
      <p className={EDITOR_HINT}>{hint}</p>
    </div>
  )
}

/**
 * The product editor while it reads. Headings and hints are already known, so they are real;
 * only the vendor's own values are placeholders, each shaped like the control it stands for.
 */
export function ProductEditorSkeleton({
  productName,
  photoUrl,
}: {
  productName: string
  /** The photo the product's row already read: a URL, null for none, undefined while unread. */
  photoUrl: string | null | undefined
}) {
  return (
    <div aria-busy="true" className={EDITOR_BODY}>
      <span role="status" aria-label="Loading product details" className="sr-only">
        Loading product details
      </span>

      <div>
        <h3 className={EDITOR_TITLE}>Photo</h3>
        {photoUrl ? (
          <div className={cn(PHOTO_FRAME, PHOTO_FILLED, 'relative mt-3 bg-slate-100')}>
            <FramedPhoto src={photoUrl} alt={`Your photo of ${productName}`} />
          </div>
        ) : (
          <Skeleton className={cn(PHOTO_FRAME, 'mt-3', photoUrl === null ? PHOTO_EMPTY : PHOTO_FILLED)} />
        )}
        <div className="mt-2.5 grid gap-0.5">
          {photoUrl ? <SavedPhotoStatus /> : null}
          {photoUrl === undefined ? (
            <div className="flex h-5 items-center">
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          ) : (
            <p className={EDITOR_HINT}>{photoHint(photoUrl !== null)}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        <Heading title="Product description" hint={DESCRIPTION_HINT} />
        <div className="grid gap-1.5">
          <div className="grid h-28 content-start gap-3 rounded-lg border border-[var(--md-border)] bg-white p-4" aria-hidden>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <Heading title="Product features" hint={FEATURES_HINT} />
        <div className={cn(FEATURE_TABLE, 'divide-y divide-[var(--md-border)]')} aria-hidden>
          {FEATURE_ROWS.map((row) => (
            <div key={row.label} className={FEATURE_COLUMNS}>
              <div className="flex h-11 items-center bg-emerald-50/70 px-3 sm:border-r sm:border-[var(--md-border)]">
                <Skeleton className={cn('h-3', row.label)} />
              </div>
              <div className="flex h-11 items-center px-3 max-sm:col-start-1">
                <Skeleton className={cn('h-3', row.detail)} />
              </div>
            </div>
          ))}
          <div className="flex h-11 items-center px-3">
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
