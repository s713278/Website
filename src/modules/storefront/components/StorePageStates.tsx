import type { ReactNode, RefObject } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, EmptyState } from '@/shared/components'
import { LoadingStatus } from '@/shared/components/LoadingStatus'
import {
  StorePageSkeleton,
  type StorePageSkeletonLayout,
} from './StorePageSkeleton'
import { peekStoreIdentity } from '@/modules/storefront/hooks/useStorePage'

type StorePageStatesProps = {
  wrapperRef: RefObject<HTMLDivElement | null>
  loading: boolean
  error: string
  ready: boolean
  /** Shown in the loading pill and announced to screen readers. */
  loadingLabel: string
  /** Skeleton layout: `home` for the store landing page, `panel` for sub-pages. */
  loadingLayout?: StorePageSkeletonLayout
  emptyTitle: string
  emptyDescription: string
  backHref: string
  backLabel?: string
  /** Lets the loading header show the store name and logo. */
  storeId?: string
  /** Re-runs the failed request. Falls back to a full page reload. */
  onRetry?: () => void
  children: ReactNode
}

type NavHint = { storeName?: string } | null

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
  storeId,
  onRetry,
  children,
}: StorePageStatesProps) {
  const location = useLocation()
  const retry = onRetry ?? (() => window.location.reload())

  const hint = location.state as NavHint
  const identity = storeId ? peekStoreIdentity(storeId) : null
  const storeName = identity?.name ?? hint?.storeName
  const logoUrl = identity?.logoUrl

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      {loading ? (
        <div aria-busy="true">
          <span className="sr-only">{loadingLabel}</span>
          <StorePageSkeleton layout={loadingLayout} storeName={storeName} logoUrl={logoUrl} />
          <LoadingStatus loading={loading} label={loadingLabel} onRetry={retry} />
        </div>
      ) : !ready ? (
        <div className="store-shell-inner py-24">
          <EmptyState
            title={error ? 'Could not load this page' : emptyTitle}
            description={error || emptyDescription}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                {error ? <Button onClick={retry}>Try again</Button> : null}
                <Link to={backHref}>
                  <Button variant="secondary">{backLabel}</Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        children
      )}
    </div>
  )
}