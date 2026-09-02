import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '@/shared/components'
import {
  StorePageSkeleton,
  type StorePageSkeletonLayout,
} from './StorePageSkeleton'

type StorePageStatesProps = {
  wrapperRef: RefObject<HTMLDivElement | null>
  loading: boolean
  error: string
  ready: boolean
  /** Screen-reader label while the skeleton is visible. */
  loadingLabel: string
  /** Skeleton layout — `home` for the store landing page, `panel` for sub-pages. */
  loadingLayout?: StorePageSkeletonLayout
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
  loadingLayout = 'panel',
  emptyTitle,
  emptyDescription,
  backHref,
  backLabel = 'Back to store',
  children,
}: StorePageStatesProps) {
  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      {loading ? (
        <div aria-busy="true" aria-live="polite">
          <span className="sr-only">{loadingLabel}</span>
          <StorePageSkeleton layout={loadingLayout} />
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
