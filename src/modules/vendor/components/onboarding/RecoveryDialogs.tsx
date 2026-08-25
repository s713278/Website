import { AlertDialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { Button } from '@/shared/components/ui'

function DialogFrame({ children }: { children: ReactNode }) {
  return (
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
      <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:zoom-in-95 motion-reduce:animate-none">
        {children}
      </AlertDialog.Content>
    </AlertDialog.Portal>
  )
}

export function DraftConflictDialog({
  open,
  onLoad,
  onOverwrite,
}: {
  open: boolean
  onLoad: () => void
  onOverwrite: () => void
}) {
  return (
    <AlertDialog.Root open={open}>
      <DialogFrame>
        <AlertDialog.Title className="font-display text-lg font-semibold">A newer draft was saved in another tab</AlertDialog.Title>
        <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose which version to keep. Saving in this tab is paused until you decide.
        </AlertDialog.Description>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialog.Action asChild><Button variant="outline" onClick={onOverwrite}>Keep this tab and overwrite</Button></AlertDialog.Action>
          <AlertDialog.Action asChild><Button onClick={onLoad}>Load newer draft</Button></AlertDialog.Action>
        </div>
      </DialogFrame>
    </AlertDialog.Root>
  )
}

export function CorruptDraftDialog({ open, onReset }: { open: boolean; onReset: () => void }) {
  return (
    <AlertDialog.Root open={open}>
      <DialogFrame>
        <AlertDialog.Title className="font-display text-lg font-semibold">Saved draft cannot be opened</AlertDialog.Title>
        <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
          Its version or structure is unsupported. Resetting removes only the onboarding draft and leaves other app data untouched.
        </AlertDialog.Description>
        <div className="mt-6 flex justify-end">
          <AlertDialog.Action asChild><Button variant="danger" onClick={onReset}>Reset saved draft</Button></AlertDialog.Action>
        </div>
      </DialogFrame>
    </AlertDialog.Root>
  )
}
