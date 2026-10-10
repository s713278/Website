import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { VENDOR_ONBOARDING_HREF } from '@/app/router/role-home'
import { peekVendorAccountContext } from '@/modules/vendor/lib/onboarding-state-cache'
import { useVendorHeaderHint } from '@/modules/vendor/store/vendor-header-hint-store'
import type { StoreSubmission } from '@/modules/vendor/types/onboarding'
import { isLiveApi } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import {
  resolveHeaderActions,
  type HeaderAccountRead,
  type HeaderAction,
} from '../lib/header-actions'

/**
 * The header's right-hand actions for the current session and vendor account.
 *
 * `MarketingHeader` is in every visitor's first bundle, so the account read and the
 * onboarding store are imported on demand and only for a vendor session — the same
 * rule `vendor-landing` follows. On every route, the wizard included, the read is the
 * vendor context alone, which is all the decision needs and lands long before the wizard's
 * setup reads do. On the wizard it joins the wizard's own context request.
 */
export function useHeaderActions(): HeaderAction[] {
  const user = useAuthStore((state) => state.user)
  const { pathname } = useLocation()
  const live = isLiveApi()
  const isVendor = user?.roles.includes('vendor') ?? false
  const vendorId = user?.vendorId ?? null
  const readsAccount = live && isVendor && vendorId !== null
  const onWizard = pathname.replace(/\/+$/, '') === VENDOR_ONBOARDING_HREF

  const [read, setRead] = useState<{ vendorId: string; result: HeaderAccountRead } | null>(null)
  const [submission, setSubmission] = useState<StoreSubmission | null>(null)
  // TEMP(vendor-header-hint): see docs/SESSION.md for removal.
  const hint = useVendorHeaderHint(vendorId)

  useEffect(() => {
    if (!readsAccount) return
    let ignore = false
    import('@/modules/vendor/lib/onboarding-server-state')
      .then(({ loadVendorAccountContext }) => {
        if (ignore) return null
        return loadVendorAccountContext(vendorId)
      })
      .then(
        (state) => {
          if (!ignore && state) setRead({ vendorId, result: { status: 'ready', state } })
        },
        () => {
          if (!ignore) setRead({ vendorId, result: { status: 'failed' } })
        },
      )
    return () => {
      ignore = true
    }
  }, [readsAccount, vendorId])

  // Follows the wizard, which is where a submission happens. Live, it only matters while
  // the wizard is on screen; demo has no account read, so the wizard is the only source.
  const followsWizard = isVendor && (!live || onWizard)
  useEffect(() => {
    if (!followsWizard) return
    let ignore = false
    let unsubscribe: (() => void) | undefined
    import('@/modules/vendor/store/onboarding-store').then(
      ({ useOnboardingStore }) => {
        if (ignore) return
        setSubmission(useOnboardingStore.getState().storeSubmission)
        unsubscribe = useOnboardingStore.subscribe((state) => setSubmission(state.storeSubmission))
      },
      () => {
        // A chunk that fails to load leaves the account-derived actions in place.
      },
    )
    return () => {
      ignore = true
      unsubscribe?.()
    }
  }, [followsWizard])

  // A resolved cache entry paints the right actions on the first frame instead of after
  // the effect above. The caches are dropped on go-live, so this never outlives it.
  const cached = readsAccount ? peekVendorAccountContext(vendorId) : null
  let account: HeaderAccountRead = { status: 'loading' }
  if (cached) account = { status: 'ready', state: { context: cached } }
  else if (read?.vendorId === vendorId) account = read.result
  // TEMP(vendor-header-hint): see docs/SESSION.md for removal.
  // The last-known record stands in until this session's read lands, and stays if it fails.
  // It only selects links; the read still runs and corrects it.
  if (readsAccount && hint && account.status !== 'ready') {
    account = { status: 'ready', state: { context: hint } }
  }

  return resolveHeaderActions({ user, live, account, submission, pathname })
}
