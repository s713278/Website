import { createContext, useContext } from 'react'
import type { VendorContext } from '@/shared/api'
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
}

export const VendorAccountContext = createContext<VendorAccount | null>(null)

export function useVendorAccount(): VendorAccount {
  const account = useContext(VendorAccountContext)
  if (!account) {
    throw new Error('useVendorAccount must be used inside the vendor dashboard shell')
  }
  return account
}
