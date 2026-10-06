import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { CheckIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui'
import {
  TAGLINE_EXAMPLE_GROUPS,
  taglineGroupIdForBusinessType,
} from '../../data/tagline-examples'

type CopyState = { tagline: string; status: 'copied' | 'failed' } | null

/**
 * The "Examples" button beside the Step 9 tagline field and the dialog it opens.
 * Opens on the vendor's own business type, but every type's samples stay one tap away.
 */
export function TaglineExamplesDialog({
  businessTypeName,
  currentTagline,
  onUse,
}: {
  businessTypeName: string | null | undefined
  currentTagline: string
  onUse: (tagline: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [groupId, setGroupId] = useState(() => taglineGroupIdForBusinessType(businessTypeName))
  const [copyState, setCopyState] = useState<CopyState>(null)
  const activeChipRef = useRef<HTMLButtonElement>(null)
  const group = TAGLINE_EXAMPLE_GROUPS.find((item) => item.id === groupId) ?? TAGLINE_EXAMPLE_GROUPS[0]

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setGroupId(taglineGroupIdForBusinessType(businessTypeName))
      setCopyState(null)
    }
    setOpen(next)
  }

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      activeChipRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, groupId])

  useEffect(() => {
    if (!copyState) return
    const timer = window.setTimeout(() => setCopyState(null), 2000)
    return () => window.clearTimeout(timer)
  }, [copyState])

  const copy = async (tagline: string) => {
    try {
      await navigator.clipboard.writeText(tagline)
      setCopyState({ tagline, status: 'copied' })
    } catch {
      setCopyState({ tagline, status: 'failed' })
    }
  }

  const use = (tagline: string) => {
    onUse(tagline)
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          className="border-primary/25 bg-primary/[0.08] font-semibold text-primary hover:bg-primary/[0.14] hover:text-primary dark:border-primary/30 dark:bg-primary/[0.12]"
        >
          Examples
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border bg-card shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] outline-none',
            'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(88dvh,36rem)] sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 motion-reduce:animate-none',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 pt-5 pb-4 sm:pt-4 sm:pb-3">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold sm:text-base">Tagline examples</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-muted-foreground sm:mt-0.5 sm:text-[0.8rem]">
                Pick a sample from any business type, then use it or copy it.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center sm:size-8 rounded-full bg-muted text-muted-foreground outline-none transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div
            role="group"
            aria-label="Business types"
            className="flex shrink-0 gap-2 overflow-x-auto px-5 pt-4 pb-2 [scrollbar-width:thin]"
          >
            {TAGLINE_EXAMPLE_GROUPS.map((item) => {
              const active = item.id === group.id
              return (
                <button
                  key={item.id}
                  ref={active ? activeChipRef : undefined}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGroupId(item.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold sm:px-2.5 sm:py-1 sm:text-xs whitespace-nowrap text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                    active && 'border-primary bg-primary/[0.08] text-primary hover:text-primary',
                  )}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </div>

          <ul aria-label={`${group.label} taglines`} className="flex flex-col gap-2 overflow-y-auto px-5 pt-2 pb-5">
            {group.taglines.map((tagline) => {
              const inUse = tagline === currentTagline.trim()
              const copyStatus = copyState?.tagline === tagline ? copyState.status : null
              return (
                <li
                  key={tagline}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-muted/40 py-3 pr-3 pl-4 sm:py-2.5 sm:pr-2.5 sm:pl-3.5',
                    inUse && 'border-primary/40 bg-primary/[0.05]',
                  )}
                >
                  <p className="min-w-0 flex-1 text-[0.95rem] leading-snug font-medium break-words sm:text-sm">{tagline}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Copy “${tagline}”`}
                      onClick={() => void copy(tagline)}
                      className="rounded-full px-3.5 font-semibold sm:h-8 sm:px-3 sm:text-xs"
                    >
                      {copyStatus === 'copied' ? (
                        <>
                          <CheckIcon aria-hidden="true" />
                          Copied
                        </>
                      ) : copyStatus === 'failed' ? (
                        "Can't copy"
                      ) : (
                        'Copy'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      aria-label={inUse ? `“${tagline}” is your tagline` : `Use “${tagline}”`}
                      disabled={inUse}
                      onClick={() => use(tagline)}
                      className="rounded-full px-3.5 font-semibold sm:h-8 sm:px-3 sm:text-xs"
                    >
                      {inUse ? 'In use' : 'Use'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="sr-only" aria-live="polite">
            {copyState?.status === 'copied' ? 'Tagline copied.' : copyState?.status === 'failed' ? 'Copy failed. Select the text to copy it.' : ''}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
