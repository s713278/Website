import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { clearOnboardingDraft } from '@/modules/vendor/lib/onboarding-draft-keys'
import { invalidateVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import { configureApiClient, onCredentialsRefused, setApiErrorLogger } from '@/shared/api'
import { onExplicitSignOut, useAuthStore } from '@/shared/auth/store/auth-store'

export function AppProviders({ children }: { children: ReactNode }) {
  // Signing out must not leave the previous vendor's onboarding draft in this browser,
  // whatever route it happened on. The wizard's own ownership check is the backstop for
  // sessions that end without an explicit sign-out.
  useEffect(() => onExplicitSignOut(clearOnboardingDraft), [])

  // Cached account reads are one vendor's store details and must not outlive their
  // session — the next sign-in on this browser may be someone else.
  useEffect(() => onExplicitSignOut(() => invalidateVendorOnboardingState()), [])

  // A verification the app refused must not survive in `md-auth`, whose persisted token
  // is pushed back into the api-client store on the next load. Wired here so the cleanup
  // does not depend on an OTP screen still being mounted.
  useEffect(() => onCredentialsRefused(() => useAuthStore.getState().clearSession()), [])

  useEffect(() => {
    setApiErrorLogger((payload) => {
      console.error('[api]', payload)
    })

    configureApiClient({
      // Failed refresh → clear local session only (no server signout / no logout loop)
      onUnauthorized: () => {
        useAuthStore.getState().clearSession()
      },
      // 403 → authenticated but not permitted for this resource. The session is still
      // valid, so keep it and let the feature decide what to show; signing out here
      // would throw away unsaved work.
      onForbidden: () => {
        useAuthStore.getState().setSessionProblem('forbidden')
      },
    })

    // Must run after configureApiClient so a restoration refresh uses the configured base URL.
    void useAuthStore.getState().restoreSession()
  }, [])

  return children
}
