/**
 * Storage keys for the vendor onboarding browser draft, and the one operation that
 * needs them without the rest of the persistence layer.
 *
 * Kept as a leaf module so app-level wiring (sign-out cleanup) does not pull the
 * draft validators into the initial bundle for every visitor.
 */
export const ONBOARDING_DRAFT_STORAGE_KEY = 'md-vendor-onboarding-draft-v3'

/**
 * Keys from earlier draft shapes. They held no owner, so a draft written under one of
 * them cannot be attributed to a vendor and is removed rather than migrated.
 */
export const LEGACY_DRAFT_STORAGE_KEYS = ['md-vendor-onboarding-draft-v2'] as const

/**
 * Delete drafts written under a superseded key.
 *
 * Runs once at startup rather than from a read: those envelopes carry no owner, so they
 * cannot be attributed to a vendor and are removed instead of migrated.
 */
export function purgeLegacyOnboardingDrafts(): void {
  if (typeof window === 'undefined') return
  try {
    for (const key of LEGACY_DRAFT_STORAGE_KEYS) window.localStorage.removeItem(key)
  } catch {
    /* a browser that refuses storage has nothing to purge */
  }
}

/** Remove this browser's onboarding draft, including any superseded copies. */
export function clearOnboardingDraft(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY)
    for (const key of LEGACY_DRAFT_STORAGE_KEYS) window.localStorage.removeItem(key)
  } catch {
    /* a browser that refuses storage has nothing to clear */
  }
}
