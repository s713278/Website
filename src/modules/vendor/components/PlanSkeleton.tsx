import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/shared/components/ui'

/** Plan's first-read placeholder: the state card and two sections, under one sr-only status. */
export function PlanSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="grid gap-4">
      <span role="status" aria-label={label} className="sr-only">
        {label}
      </span>
      <Card className="grid gap-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-40" />
        <div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="mt-0.5 h-5 w-2/3" />
        </div>
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </Card>
      {[5, 4].map((lines) => (
        <Card key={lines} className="grid gap-3 p-5">
          <Skeleton className="h-7 w-32" />
          <div className="grid gap-1.5">
            {Array.from({ length: lines }, (_, i) => (
              <Skeleton key={i} className={i % 2 ? 'h-5 w-40 max-w-full' : 'h-5 w-56 max-w-full'} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
