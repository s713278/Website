import { AlertDialog } from 'radix-ui'
import { Button } from '@/shared/components/ui'

export type ConfirmDialogState = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
}

type ConfirmDialogProps = ConfirmDialogState & {
  onOpenChange: (open: boolean) => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'default',
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:zoom-in-95 motion-reduce:animate-none">
          <AlertDialog.Title className="font-display text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={tone === 'danger' ? 'danger' : 'primary'}
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
