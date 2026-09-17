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
import {
  demoService,
  getErrorMessage,
  mapVendorPlan,
  vendorOnboardingService,
  type DemoStoreStateKey,
  type VendorContext,
} from '@/shared/api'
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

  /**
   * The context is held **with the id it was loaded for**, not on its own.
   *
   * `selectVendor()` can change `vendorId` without remounting this provider. Keeping the
   * context alone made the freshness check "have I loaded anything?", so a second store
   * would have been rendered with the first store's figures until something remounted.
   * Pairing them makes the check "have I loaded *this* store?", and the key compared is
   * the one used to fetch rather than a field the backend fills in.
   */
  const [loaded, setLoaded] = useState<{ vendorId: string; context: VendorContext } | null>(() => {
    if (!vendorId) return null
    const cached = peekVendorContext(vendorId) ?? peekVendorOnboardingState(vendorId)?.context
    return cached ? { vendorId, context: cached } : null
  })
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    if (vendorId) invalidateVendorContext(vendorId)
    setLoaded(null)
    setError('')
    setReloadToken((token) => token + 1)
  }, [vendorId])

  useEffect(() => {
    if (!vendorId || loaded?.vendorId === vendorId) return
    let cancelled = false

    // A failure recorded against the previous store must not survive into this one.
    setError('')

    void loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id))
      .then((context) => {
        if (!cancelled) setLoaded({ vendorId, context })
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your store'))
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, loaded, reloadToken])

  /**
   * The demo store state, held in React so a switch re-renders.
   *
   * The service owns the mapping from a state to the two context fields it derives from;
   * this only holds which one is selected.
   */
  const [demoStoreState, setDemoStoreState] = useState(() => demoService.storeStateKey())

  const selectDemoStoreState = useCallback((key: DemoStoreStateKey) => {
    demoService.select(key)
    setDemoStoreState(key)
  }, [])

  const account = useMemo<VendorAccount | null>(() => {
    if (!vendorId || !loaded || loaded.vendorId !== vendorId) return null
    const sourceContext = loaded.context
    const isDemo = demoService.isDemo()

    // Demo substitutes the two fields the derivation reads, never the derived state — so
    // a demo screen is only ever shown a combination the backend could actually produce.
    const stateInput = isDemo
      ? demoService.storeStateFields(demoStoreState)
      : {
          vendorStatus: sourceContext.vendorStatus,
          approvalStatus: sourceContext.approvalStatus,
          onboarding: sourceContext.onboarding,
        }

    const demoResumeStep = isDemo
      ? demoService.storeStateResumeStep(demoStoreState)
      : null
    const context = demoResumeStep == null
      ? sourceContext
      : {
          ...sourceContext,
          onboarding: { ...sourceContext.onboarding, nextStep: demoResumeStep },
        }

    return {
      vendorId,
      context,
      storeState: deriveStoreState(stateInput, { coercePendingApproval: !isDemo }),
      plan: mapVendorPlan(context),
      reload,
      demo: isDemo ? { storeState: demoStoreState, select: selectDemoStoreState } : null,
    }
  }, [vendorId, loaded, reload, demoStoreState, selectDemoStoreState])

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
