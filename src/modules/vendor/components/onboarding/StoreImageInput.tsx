import { useRef, useState, type ChangeEvent } from 'react'
import { ImageIcon, UploadIcon, XIcon } from 'lucide-react'
import { Button, Spinner } from '@/shared/components/ui'
import { LoadError } from '@/shared/components/LoadError'
import type { VendorImageKind } from '@/shared/api'
import { cn } from '@/lib/utils'
import { imageSelectionError, VENDOR_IMAGE_ACCEPT } from '../../lib/onboarding-images'
import { useOnboardingStore } from '../../store/onboarding-store'
import type { ValidationIssue } from '../../types/onboarding'
import { useOnboardingFeedback } from './onboarding-feedback'
import type { ResourceStatus } from '../../lib/onboarding-resume'

export function StoreImageLoadNotice({ kind, onRetry }: { kind: VendorImageKind; onRetry: () => void }) {
  return <LoadError message={`Could not load your saved ${kind}. You can continue without its preview.`} retryLabel={`Retry ${kind}`} onRetry={onRetry} />
}

export function StoreImageInput({ kind, issues, live, loadState = 'loaded', onRetry }: {
  kind: VendorImageKind
  issues: ValidationIssue[]
  live: boolean
  loadState?: ResourceStatus
  onRetry?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const chooseButtonRef = useRef<HTMLButtonElement>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const feedback = useOnboardingFeedback()
  const runtime = useOnboardingStore((state) => state.runtime)
  const setImage = useOnboardingStore((state) => state.setImage)
  const isLogo = kind === 'logo'
  const file = isLogo ? runtime.logoFile : runtime.bannerFile
  const url = isLogo ? runtime.logoUrl : runtime.bannerUrl
  const label = isLogo ? 'Logo' : 'Banner'
  const id = `store-${kind}-file`
  const error = selectionError ?? issues.find((issue) => issue.field === id)?.message

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!chosen) return
    const invalid = imageSelectionError(chosen)
    if (invalid) {
      setSelectionError(invalid)
      feedback.show(invalid, 'error')
      return
    }
    try {
      setImage(kind, chosen, URL.createObjectURL(chosen))
      setSelectionError(null)
    } catch {
      const message = 'This image could not be opened for preview. Choose another file.'
      setSelectionError(message)
      feedback.show(message, 'error')
    }
  }

  return (
    <div className="min-w-0 rounded-xl bg-[var(--ob-sheet)] p-4 ring-1 ring-[var(--ob-line)]">
      <h3 className="text-sm font-semibold">{isLogo ? 'Store logo' : 'Home banner'}</h3>
      <p id={`${id}-guidance`} className="mt-1 text-xs leading-5 text-[var(--ob-ink-soft)]">
        {isLogo ? 'Recommended: 512 × 512 px · 1:1 square. Minimum: 200 × 200 px.' : 'Recommended: 2400 × 800 px · 3:1 wide. Minimum: 1200 × 400 px.'}
      </p>
      <div className={cn(
        'relative mt-3',
        isLogo ? 'aspect-square w-40 max-w-full' : 'aspect-[3/1] w-full',
      )}>
        <button
          ref={chooseButtonRef}
          id={`${id}-button`}
          type="button"
          aria-label={`${url ? 'Replace' : 'Choose'} ${kind} image`}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={`${id}-guidance ${id}-formats${error ? ` ${id}-error` : ''}`}
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 grid size-full cursor-pointer grid-rows-[minmax(0,1fr)] place-items-center overflow-hidden rounded-xl border-2 border-dashed border-[var(--ob-ink-soft)] bg-[var(--ob-canvas)] p-0.5 text-[var(--ob-ink-soft)] outline-none transition-[border-color,background-color] duration-150 enabled:hover:border-[var(--ob-brand)] enabled:hover:bg-[var(--ob-brand-soft)] focus-visible:border-[var(--ob-brand)] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {url && failedUrl !== url ? (
            <img src={url} alt={`${label} upload preview`} className={cn('size-full min-h-0 min-w-0 rounded-md', isLogo ? 'object-contain' : 'object-cover object-center')} onError={() => setFailedUrl(url)} />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-center text-xs">
              <ImageIcon className="size-6 shrink-0" aria-hidden="true" />
              <span className="font-medium">{url ? 'Preview unavailable' : `Upload ${kind}`}</span>
            </span>
          )}
        </button>
        {file ? (
          <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${kind} selection`} className="absolute top-1.5 right-1.5 z-10 size-6 cursor-pointer rounded-full bg-black/55 p-0 text-white hover:bg-[rgba(220,38,38,0.9)] hover:text-white focus-visible:ring-white dark:hover:bg-[rgba(220,38,38,0.9)]" onClick={() => {
            setImage(kind, null, null)
            setSelectionError(null)
            chooseButtonRef.current?.focus()
          }}><XIcon className="size-3" aria-hidden="true" /></Button>
        ) : null}
      </div>
      <input ref={inputRef} id={id} type="file" aria-label={`Choose ${kind} image`} aria-invalid={Boolean(error) || undefined} aria-describedby={`${id}-guidance ${id}-formats${error ? ` ${id}-error` : ''}`} accept={VENDOR_IMAGE_ACCEPT} className="sr-only" tabIndex={-1} onChange={selectImage} />
      <Button type="button" variant="link" size="sm" className="mt-1 h-8 cursor-pointer px-0 text-xs text-[var(--md-green-700)] dark:text-emerald-400" aria-describedby={`${id}-guidance ${id}-formats${error ? ` ${id}-error` : ''}`} onClick={() => inputRef.current?.click()}>
        <UploadIcon className="size-3.5" aria-hidden="true" />{url ? 'Replace' : 'Upload'} {kind}
      </Button>
      <p id={`${id}-formats`} className="mt-2 text-xs text-[var(--ob-ink-soft)]">PNG, JPEG, or GIF · 5 MB max</p>
      <p className="mt-1 text-xs leading-5 text-[var(--ob-ink-soft)]">{isLogo ? 'Your whole logo fits inside the square.' : 'Banner edges may be cropped. Keep important content in the centre.'}</p>
      {file ? <p className="mt-2 break-all text-xs font-medium">{file.name} · {live ? 'Not saved yet' : 'Preview only'}</p>
        : url ? <p className="mt-2 text-xs font-medium text-[var(--ob-brand)]">Saved image</p> : null}
      {!file && (loadState === 'idle' || loadState === 'loading') ? <span className="mt-2 inline-flex"><Spinner label={`Loading saved ${kind}`} /></span> : null}
      {!file && loadState === 'failed' && onRetry ? <div className="mt-3"><StoreImageLoadNotice kind={kind} onRetry={onRetry} /></div> : null}
      {error ? <p id={`${id}-error`} className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
