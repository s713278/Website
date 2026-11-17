import type { OnboardingStep } from '../types/onboarding'
import { isAccountStep, type AccountStep } from './onboarding-progress'
import type { OnboardingResource } from './onboarding-resume'

/**
 * Revalidation before a write, once the page has been away (`page-away`) since this visit read
 * the account. Another tab or device may have saved meanwhile, and nothing on the account says
 * so (no version or ETag), so the write's own inputs are read again first and merged with the
 * same rules as on entry (`mergeAccountFields`). Lazy: a page that comes back and never writes
 * reads nothing more.
 *
 * The context is always read again: it owns progress, submission and the plan limits. These
 * are the resources each step's write is built from, beyond it:
 *
 * - Step 3: the profile, only while the type is unlocked, to tell a type saved elsewhere. A
 *   locked type can only be sent again.
 * - Step 9: the storefront settings of an approved store, which carry its name. Before
 *   approval, the vendor record for the store name; the rest is unreadable, and images are
 *   written only when the vendor picks one.
 * - Step 10: what each step with unsaved input needs, so one saved from another tab stops
 *   counting as unsaved. Submission writes nothing else.
 */
const STEP_READS: Record<Exclude<AccountStep, 3 | 9>, readonly OnboardingResource[]> = {
  4: ['categories'],
  5: ['products'],
  // Sizes are matched to their products, so a product saved elsewhere must be known too.
  6: ['products', 'skus'],
  7: ['checkout'],
  8: ['checkout'],
}

export function revalidationReads(
  step: OnboardingStep,
  options: { submitted: boolean; approved: boolean; typeLocked: boolean; pending: readonly AccountStep[] },
): OnboardingResource[] {
  const reads = (owner: AccountStep): readonly OnboardingResource[] => {
    if (owner === 3) return options.typeLocked ? [] : ['profile']
    if (owner === 9) return options.submitted && options.approved ? ['storefront'] : ['profile']
    return STEP_READS[owner]
  }
  if (step === 10) return options.submitted ? [] : [...new Set(options.pending.flatMap(reads))]
  return isAccountStep(step) ? [...reads(step)] : []
}

/**
 * A runtime-only value (payment details, WhatsApp numbers) after a fresh read, by the draft's
 * rule: untouched since its last saved value, the account's; edited, the edit while the account
 * still holds that saved value, otherwise the account's newer one. With no known saved value
 * the input stays: it may be a failed save's.
 */
export function mergeRuntimeValue<T>(local: T, saved: T | undefined, account: T): T {
  if (saved === undefined) return local
  return local === saved || account !== saved ? account : local
}

/** `mergeRuntimeValue` for each value of a flat record of strings. */
export function mergeRuntimeRecord<T extends Record<string, string>>(local: T, saved: T | undefined, account: T): T {
  const merged = { ...local }
  for (const key of Object.keys(account) as (keyof T)[]) {
    merged[key] = mergeRuntimeValue(local[key], saved?.[key], account[key])
  }
  return merged
}
