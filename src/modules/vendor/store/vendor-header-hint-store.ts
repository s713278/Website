import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VendorContext, VendorOnboardingStatus } from '@/shared/api'

/**
 * TEMP(vendor-header-hint): the signed-in vendor's last-known account state, persisted so
 * the marketing header can pick its buttons on the first frame instead of waiting for the
 * vendor context read.
 *
 * Temporary. It stands in for a query cache's persisted `placeholderData` until the
 * Zustand + TanStack Query caching layer lands. Remove it then, together with:
 * - this module and its test;
 * - the two cache writes (`vendor-context-cache.ts`, `onboarding-server-state.ts`);
 * - the header fallback (`useHeaderActions.ts`);
 * - the sign-out registration (`AppProviders.tsx`);
 * - the hint cases in `MarketingHeader.test.tsx`;
 * - the docs/SESSION.md subsection and the AGENTS.md line.
 * docs/SESSION.md owns the checklist.
 *
 * The header is in every visitor's first bundle, so this imports only `zustand` and
 * erased types.
 */

/**
 * What `resolveHeaderActions` and the account-status predicates read. `description` is
 * unread but kept so the hint satisfies their context types without a cast.
 */
export type VendorHeaderHint = {
  vendorId: string
  vendorStatus: string | null
  approvalStatus: string | null
  storeIdentifier: string | null
  onboarding: {
    status: VendorOnboardingStatus
    description: string | null
    /** A completed ACTIVE context omits `next_step`. */
    nextStep: number | null
  }
}

type State = {
  hint: VendorHeaderHint | null
}

const ONBOARDING_STATUSES: readonly VendorOnboardingStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'UNKNOWN',
]

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isHint(value: unknown): value is VendorHeaderHint {
  if (!value || typeof value !== 'object') return false
  const hint = value as Partial<VendorHeaderHint>
  const onboarding = hint.onboarding as Partial<VendorHeaderHint['onboarding']> | undefined
  return (
    typeof hint.vendorId === 'string' &&
    isNullableString(hint.vendorStatus) &&
    isNullableString(hint.approvalStatus) &&
    isNullableString(hint.storeIdentifier) &&
    !!onboarding &&
    typeof onboarding === 'object' &&
    ONBOARDING_STATUSES.includes(onboarding.status as VendorOnboardingStatus) &&
    isNullableString(onboarding.description) &&
    (onboarding.nextStep === null || typeof onboarding.nextStep === 'number')
  )
}

export const useVendorHeaderHintStore = create<State>()(
  persist(
    (): State => ({ hint: null }),
    {
      name: 'md-vendor-header-hint',
      version: 1,
      // A malformed entry is dropped rather than trusted.
      merge: (persisted, current) => {
        const hint = (persisted as { hint?: unknown } | undefined)?.hint
        return { ...current, hint: isHint(hint) ? hint : null }
      },
    },
  ),
)

/** Keeps the subset the header needs. Another vendor's read replaces the entry. */
export function rememberVendorHeaderHint(context: VendorContext): void {
  useVendorHeaderHintStore.setState({
    hint: {
      vendorId: context.vendorId,
      vendorStatus: context.vendorStatus,
      approvalStatus: context.approvalStatus,
      storeIdentifier: context.storeIdentifier,
      onboarding: {
        status: context.onboarding.status,
        description: context.onboarding.description,
        nextStep: context.onboarding.nextStep,
      },
    },
  })
}

function ownedHint(hint: VendorHeaderHint | null, vendorId: string | null) {
  return vendorId && hint?.vendorId === vendorId ? hint : null
}

/** `null` unless the stored hint belongs to `vendorId`. */
export function readVendorHeaderHint(vendorId: string | null): VendorHeaderHint | null {
  return ownedHint(useVendorHeaderHintStore.getState().hint, vendorId)
}

/** Selects the stored object itself, so the result is stable between renders. */
export function useVendorHeaderHint(vendorId: string | null): VendorHeaderHint | null {
  return useVendorHeaderHintStore((state) => ownedHint(state.hint, vendorId))
}

export function clearVendorHeaderHint(): void {
  useVendorHeaderHintStore.setState({ hint: null })
  // Without this the key would stay behind as `{ hint: null }`. `persist` is absent when
  // there is no storage at all (the node test tier), hence the optional call.
  useVendorHeaderHintStore.persist?.clearStorage()
}
