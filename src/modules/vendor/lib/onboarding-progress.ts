import { createEmptyRuntimeState } from '../data/onboarding-defaults'
import type {
  OnboardingRuntimeState,
  OnboardingStep,
  ValidationIssue,
  VendorOnboardingDraftV1,
} from '../types/onboarding'

/**
 * Setup progress, unsaved input and where a save lands, kept apart.
 *
 * Saved progress is the account's: the vendor context's `next_step` decides which steps are
 * done and reachable, and only a confirmed save adds to it in a visit. Unsaved input is what
 * differs from the step's last saved values. An edit never takes progress away, so changing
 * an earlier step and changing it back leaves nothing pending and nothing locked.
 */

/** The steps an account copy, and so a saved baseline, can describe. */
export const ACCOUNT_STEPS = [3, 4, 5, 6, 7, 8, 9] as const satisfies readonly OnboardingStep[]
export type AccountStep = (typeof ACCOUNT_STEPS)[number]

/** What each step owns: the part of the draft it saves, plus any runtime-only fields. */
export type StepSnapshots = {
  3: Pick<VendorOnboardingDraftV1['business'], 'businessType'>
  4: Pick<VendorOnboardingDraftV1, 'categories'>
  5: Pick<VendorOnboardingDraftV1, 'products'>
  6: Pick<VendorOnboardingDraftV1, 'skus'>
  7: Pick<VendorOnboardingDraftV1, 'delivery'>
  8: Pick<VendorOnboardingDraftV1, 'payments'> & Pick<OnboardingRuntimeState, 'paymentDetails'>
  9: Pick<VendorOnboardingDraftV1['business'], 'businessName'>
    & Pick<VendorOnboardingDraftV1, 'storefront'>
    & Pick<OnboardingRuntimeState, 'orderWhatsapp' | 'supportWhatsapp'>
}

/**
 * Each step's last saved values: what an account read returned, or what a confirmed save
 * sent. In memory only and reset on every entry, because Step 8's payment details are
 * private and must never reach browser storage.
 */
export type SavedBaselines = { [S in AccountStep]?: StepSnapshots[S] }

/** Snapshot keys that live in runtime state rather than the persisted draft. */
const RUNTIME_KEYS = new Set(['paymentDetails', 'orderWhatsapp', 'supportWhatsapp'])

export function isAccountStep(step: OnboardingStep): step is AccountStep {
  return step >= 3 && step <= 9
}

export function stepSnapshot<S extends AccountStep>(
  step: S,
  draft: VendorOnboardingDraftV1,
  runtime: Pick<OnboardingRuntimeState, 'paymentDetails' | 'orderWhatsapp' | 'supportWhatsapp'>,
): StepSnapshots[S] {
  const snapshots: { [K in AccountStep]: () => StepSnapshots[K] } = {
    3: () => ({ businessType: draft.business.businessType }),
    4: () => ({ categories: draft.categories }),
    5: () => ({ products: draft.products }),
    6: () => ({ skus: draft.skus }),
    7: () => ({ delivery: draft.delivery }),
    8: () => ({ payments: draft.payments, paymentDetails: runtime.paymentDetails }),
    9: () => ({
      businessName: draft.business.businessName,
      storefront: draft.storefront,
      orderWhatsapp: runtime.orderWhatsapp,
      supportWhatsapp: runtime.supportWhatsapp,
    }),
  }
  return snapshots[step]()
}

function sameValues(a: object, b: object, draftOnly: boolean): boolean {
  const keys = Object.keys(a).filter((key) => !draftOnly || !RUNTIME_KEYS.has(key))
  const pick = (value: object) => keys.map((key) => (value as Record<string, unknown>)[key])
  const left = pick(a)
  const right = pick(b)
  if (left.every((part, index) => part === right[index])) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Whether the step's persisted draft section still matches its saved baseline. `null` when
 * no baseline is known this visit. Runtime fields are left out: the persisted edited set
 * only says which draft sections outrank the account copy.
 */
export function draftMatchesBaseline(
  step: AccountStep,
  draft: VendorOnboardingDraftV1,
  baselines: SavedBaselines,
): boolean | null {
  const baseline = baselines[step]
  if (!baseline) return null
  return sameValues(baseline, stepSnapshot(step, draft, createEmptyRuntimeState()), true)
}

type PendingState = {
  draft: VendorOnboardingDraftV1
  runtime: OnboardingRuntimeState
  editedSteps: readonly OnboardingStep[]
  savedBaselines: SavedBaselines
}

/**
 * Steps 3-9 holding input that has not been saved. Against a known baseline that is any
 * difference, runtime fields included, so reverting a change leaves nothing pending. Without
 * one (a step not read this visit, or the demo before its first simulated save) the persisted
 * edited set stands in. A chosen but unsent logo or banner is always pending.
 */
export function pendingSteps(state: PendingState): AccountStep[] {
  return ACCOUNT_STEPS.filter((step) => {
    if (step === 9 && (state.runtime.logoFile || state.runtime.bannerFile)) return true
    const baseline = state.savedBaselines[step]
    if (!baseline) return state.editedSteps.includes(step)
    return !sameValues(baseline, stepSnapshot(step, state.draft, state.runtime), false)
  })
}

const PENDING_SUBJECT: Record<AccountStep, string> = {
  3: 'business type',
  4: 'categories',
  5: 'products',
  6: 'sizes and prices',
  7: 'delivery',
  8: 'payments',
  9: 'store details',
}

/** Submission waits until every step's input is saved or undone. */
export function pendingEditIssues(steps: readonly AccountStep[]): ValidationIssue[] {
  return steps.map((step) => ({
    step,
    field: `pending-step-${step}`,
    message: `Save or undo your changes to ${PENDING_SUBJECT[step]}.`,
  }))
}

/**
 * The step a save returns to, after a move from `from` to `to`.
 *
 * Going back from a setup step remembers where the vendor was, and browsing other earlier
 * steps keeps it; reaching it, or anything past it, forgets it. Identity steps never take
 * part. In memory only: an entry or reload opens the account's `next_step` instead.
 */
export function returnStepAfterMove(
  returnStep: OnboardingStep | null,
  from: OnboardingStep,
  to: OnboardingStep,
): OnboardingStep | null {
  if (to < 3 || from < 3) return null
  if (returnStep !== null) return to >= returnStep ? null : returnStep
  return to < from ? from : null
}

/** Where a successful save of `step` lands: the remembered step, or the next one. */
export function stepAfterSave(step: OnboardingStep, returnStep: OnboardingStep | null): OnboardingStep {
  if (returnStep !== null && returnStep > step) return returnStep
  return Math.min(step + 1, 10) as OnboardingStep
}

/** The steps the account reports done: everything before the one it opens on. */
export function completedBefore(openAt: OnboardingStep): OnboardingStep[] {
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as OnboardingStep[]).filter((step) => step < openAt)
}

/**
 * The draft and runtime a Step 7 or 8 save sends. The two share one full checkout write, so
 * the other step's section comes from its last saved values, never its pending edits. `null`
 * while those values are unknown: the caller reads the account's checkout first.
 */
export function checkoutWriteInput(
  step: 7 | 8,
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
  baselines: SavedBaselines,
): { draft: VendorOnboardingDraftV1; runtime: OnboardingRuntimeState } | null {
  if (step === 7) {
    const payments = baselines[8]
    if (!payments) return null
    return {
      draft: { ...draft, payments: payments.payments },
      runtime: { ...runtime, paymentDetails: payments.paymentDetails },
    }
  }
  const delivery = baselines[7]
  if (!delivery) return null
  return { draft: { ...draft, delivery: delivery.delivery }, runtime }
}
