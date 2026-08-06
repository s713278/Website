import { cn } from '@/shared/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--store-theme)_10%,#e5e7eb)]',
        className,
      )}
      {...props}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="md-container space-y-4 py-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

export function AuthSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-6" aria-busy="true">
      <Skeleton className="mx-auto h-12 w-12 rounded-full" />
      <Skeleton className="mx-auto h-7 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}
