import { Skeleton } from '@/shared/components/ui/skeleton';

export function DashSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className} aria-hidden />;
}

export function MetricsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading metrics">
      {Array.from({ length: 4 }).map((_, i) => (
        <DashSkeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading table">
      <DashSkeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <DashSkeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
