import { AlertDialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui'

export type ConfirmDialogState = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  /** The dismissing button's label; "Cancel" unless the question needs a clearer way back. */
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
}

type ConfirmDialogProps = ConfirmDialogState & {
  /**
   * Asked on top of a drawer that already dims the page. Its scrim is lighter, so the two do not
   * stack into near-black, and below 640px it rises from the bottom as an action sheet, in step
   * with the drawer, instead of a centred box that pops over a bottom sheet.
   */
  overSheet?: boolean
  onOpenChange: (open: boolean) => void
  /** Runs as the dialog closes; preventing its default leaves focus placement to the caller. */
  onCloseAutoFocus?: (event: Event) => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  overSheet = false,
  onConfirm,
  onOpenChange,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        {/* No backdrop-blur: blurring the whole wizard behind a fading overlay is redrawn every
            frame, which cut the open animation to about 10 fps. The same holds for every wizard overlay. */}
        <AlertDialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-slate-950/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none!',
            overSheet && 'bg-slate-950/20 max-sm:animation-duration-300 max-sm:ease-[cubic-bezier(0.32,0.72,0,1)]',
          )}
        />
        <AlertDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none!',
            // The sheet slides in whole: no fade or zoom, which would show the editor through it.
            overSheet &&
              'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:px-5 max-sm:pt-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:shadow-[0_-24px_80px_-28px_rgba(15,23,42,0.55)] max-sm:animation-duration-300 max-sm:ease-[cubic-bezier(0.32,0.72,0,1)] max-sm:data-[state=open]:fade-in-100 max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:fade-out-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=closed]:slide-out-to-bottom',
          )}
        >
          <AlertDialog.Title className="font-display text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className={cn(overSheet && 'max-sm:h-12')}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={tone === 'danger' ? 'danger' : 'primary'}
                className={cn(overSheet && 'max-sm:h-12')}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
