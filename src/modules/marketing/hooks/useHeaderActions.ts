import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { VENDOR_ONBOARDING_HREF } from '@/app/router/role-home'
import { peekVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
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
 * rule `vendor-landing` follows. The read is the one sign-in and the wizard share.
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

  useEffect(() => {
    if (!readsAccount) return
    let ignore = false
    import('@/modules/vendor/lib/onboarding-server-state')
      .then(({ loadVendorOnboardingState }) => loadVendorOnboardingState(vendorId))
      .then(
        (state) => {
          if (!ignore) setRead({ vendorId, result: { status: 'ready', state } })
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
  // the effect above. The cache is dropped on go-live, so this never outlives it.
  const cached = readsAccount ? peekVendorOnboardingState(vendorId) : null
  let account: HeaderAccountRead = { status: 'loading' }
  if (cached) account = { status: 'ready', state: cached }
  else if (read?.vendorId === vendorId) account = read.result

  return resolveHeaderActions({ user, live, account, submission, pathname })
}
