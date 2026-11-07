import { useLayoutEffect, useMemo } from 'react'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { resolveOnboardingAccess, type OnboardingAccess } from '../lib/onboarding-access'
import { useOnboardingStore } from '../store/onboarding-store'

export type OnboardingDraftSession = {
  access: OnboardingAccess
  /** Vendor the browser draft belongs to, or `null` while no vendor is resolved. */
  ownerId: string | null
  /** A session exists, so Steps 1-2 have already been satisfied once. */
  hasSession: boolean
  /** The stored draft has been read and attributed to an identity. */
  ready: boolean
}

/**
 * Binds the browser draft to the signed-in vendor.
 *
 * The draft is a pre-submit buffer for one vendor's account, so who is signed in
 * decides whether it may be read at all. Every surface that touches the draft uses
 * this hook, because a draft loaded under the wrong identity is both a disclosure
 * (the previous vendor's store details) and a write hazard (Continue would submit
 * them to this account).
 */
export function useOnboardingDraftSession(): OnboardingDraftSession {
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const user = useAuthStore((state) => state.user)
  const persistenceInitialized = useOnboardingStore((state) => state.persistenceInitialized)
  const initializePersistence = useOnboardingStore((state) => state.initializePersistence)

  const access = useMemo(() => resolveOnboardingAccess(user), [user])
  const ownerId = access.state === 'ready' ? access.vendorId : null

  // The single ownership entry point. `initializePersistence` reads the stored draft the
  // first time and re-checks ownership on every later call, so adoption after Steps 1-2
  // and a vendor change mid-session both come through here.
  //
  // A layout effect because the draft can already be in memory from an earlier mount and
  // must not reach the screen under the wrong identity, even for one frame. Waiting for
  // `isHydrated` matters just as much: reading earlier would compare a stored draft
  // against an empty session and discard the owner's own work on every reload.
  useLayoutEffect(() => {
    if (!isHydrated) return
    initializePersistence(ownerId)
  }, [isHydrated, ownerId, initializePersistence])

  return {
    access,
    ownerId,
    hasSession: user !== null,
    ready: isHydrated && persistenceInitialized,
  }
}
