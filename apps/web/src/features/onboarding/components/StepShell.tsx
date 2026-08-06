import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

type StepShellProps = {
  title: string;
  description: ReactNode;
  children: ReactNode;
  error?: string;
  footer?: ReactNode;
  className?: string;
};

export function StepShell({
  title,
  description,
  children,
  error,
  footer,
  className,
}: StepShellProps) {
  return (
    <section className={cn('animate-in fade-in duration-200', className)} aria-labelledby="step-title">
      <h2 id="step-title" className="font-display text-xl font-bold text-gray-900">
        {title}
      </h2>
      <p className="mb-6 mt-1 text-sm text-gray-500">{description}</p>
      {children}
      {error ? (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}
      {footer}
    </section>
  );
}
