import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { deriveStoreState } from '@/modules/vendor/lib/store-state'
import { peekVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import {
  invalidateVendorContext,
  loadVendorContext,
  peekVendorContext,
} from '@/modules/vendor/lib/vendor-context-cache'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { getErrorMessage, mapVendorPlan, vendorOnboardingService, type VendorContext } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card, EmptyState, Spinner } from '@/shared/components'

/**
 * Loads the vendor account once and shares it with every dashboard surface.
 *
 * The cache filled at sign-in is checked first, so a vendor arriving from login pays
 * nothing. Only a direct visit to a dashboard URL costs a request, and it is the narrow
 * context read rather than the full account hydration the wizard needs.
 */
export function VendorAccountProvider({ children }: { children: ReactNode }) {
  const vendorId = useAuthStore((s) => s.user?.vendorId)
  const memberships = useAuthStore((s) => s.user?.vendors)

  const [context, setContext] = useState<VendorContext | null>(
    () =>
      vendorId
        ? (peekVendorContext(vendorId) ?? peekVendorOnboardingState(vendorId)?.context ?? null)
        : null,
  )
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    if (vendorId) invalidateVendorContext(vendorId)
    setContext(null)
    setError('')
    setReloadToken((token) => token + 1)
  }, [vendorId])

  useEffect(() => {
    if (!vendorId || context) return
    let cancelled = false

    void loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id))
      .then((loaded) => {
        if (!cancelled) setContext(loaded)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your store'))
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, context, reloadToken])

  const account = useMemo<VendorAccount | null>(() => {
    if (!vendorId || !context) return null
    return {
      vendorId,
      context,
      storeState: deriveStoreState({
        vendorStatus: context.vendorStatus,
        approvalStatus: context.approvalStatus,
        nextStep: context.onboarding.nextStep,
      }),
      plan: mapVendorPlan(context),
      reload,
    }
  }, [vendorId, context, reload])

  /**
   * A session that holds several stores resolves no `vendorId`, deliberately — picking
   * the first would silently choose one. The dashboard says so rather than requesting a
   * store id it does not have; the previous pages fell back to the demo id `'r1'` and
   * asked the live API about somebody else's store.
   */
  if (!vendorId) {
    const several = (memberships?.length ?? 0) > 1
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          title={several ? 'Choose a store' : 'No store on this account'}
          description={
            several
              ? 'This account manages more than one store, and picking between them is not built yet. Sign in again from the store you want to manage.'
              : 'This account has no store yet. Set one up to get a dashboard.'
          }
        />
        {!several ? (
          <div className="mt-4 flex justify-center">
            <Link to="/onboarding">
              <Button>Set up your store</Button>
            </Link>
          </div>
        ) : null}
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <EmptyState title="Could not load your store" description={error} />
          <div className="mt-4 flex justify-center">
            <Button onClick={reload}>Try again</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Spinner label="Loading your store…" />
      </div>
    )
  }

  return <VendorAccountContext.Provider value={account}>{children}</VendorAccountContext.Provider>
}
