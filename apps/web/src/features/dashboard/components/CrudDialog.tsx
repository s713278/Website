import { useEffect, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  danger?: boolean;
  children: ReactNode;
  className?: string;
};

export function CrudDialog({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  submitDisabled,
  danger,
  children,
  className,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crud-dialog-title"
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl border border-border bg-white p-5 shadow-xl',
          className,
        )}
      >
        <div className="mb-4 space-y-1">
          <h2 id="crud-dialog-title" className="font-display text-lg font-bold">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {onSubmit ? (
            <Button
              type="button"
              size="sm"
              variant={danger ? 'destructive' : 'default'}
              disabled={submitDisabled}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
