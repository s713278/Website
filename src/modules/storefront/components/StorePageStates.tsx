import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Spinner } from '@/shared/components'

type StorePageStatesProps = {
  wrapperRef: RefObject<HTMLDivElement | null>
  loading: boolean
  error: string
  ready: boolean
  loadingLabel: string
  emptyTitle: string
  emptyDescription: string
  backHref: string
  backLabel?: string
  children: ReactNode
}

export function StorePageStates({
  wrapperRef,
  loading,
  error,
  ready,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  backHref,
  backLabel = 'Back to store',
  children,
}: StorePageStatesProps) {
  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      {loading ? (
        <div className="store-shell-inner py-24">
          <Spinner label={loadingLabel} />
        </div>
      ) : !ready ? (
        <div className="store-shell-inner py-24">
          <EmptyState
            title={emptyTitle}
            description={error || emptyDescription}
            action={
              <Link to={backHref}>
                <Button variant="secondary">{backLabel}</Button>
              </Link>
            }
          />
        </div>
      ) : (
        children
      )}
    </div>
  )
}
