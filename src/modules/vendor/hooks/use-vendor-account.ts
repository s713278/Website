import { createContext, useContext } from 'react'
import type { DemoStoreStateKey, VendorContext } from '@/shared/api'
import type { StoreState, VendorPlan } from '@/modules/vendor/types/dashboard'

/**
 * The vendor's account, read once for the whole dashboard.
 *
 * Every surface needs store state, plan limits and the business name. Reading the context
 * per page meant the same request three times over a single visit, on top of the read
 * login already performed.
 */
export type VendorAccount = {
  vendorId: string
  context: VendorContext
  storeState: StoreState
  plan: VendorPlan
  /** Re-read the account after something that changes it. */
  reload: () => void
  /**
   * Demo-mode store-state switching, `null` under a live API.
   *
   * No probe account exists in `REJECTED` or `SUSPENDED`, and creating one would mean an
   * administrator acting against a real store. Without this, two of the five state screens
   * could be built but never seen. It writes the two context fields and lets
   * `deriveStoreState` derive the rest, so it can only produce states the backend could.
   */
  demo: {
    storeState: DemoStoreStateKey
    select: (key: DemoStoreStateKey) => void
  } | null
}

export const VendorAccountContext = createContext<VendorAccount | null>(null)

export function useVendorAccount(): VendorAccount {
  const account = useContext(VendorAccountContext)
  if (!account) {
    throw new Error('useVendorAccount must be used inside the vendor dashboard shell')
  }
  return account
}
