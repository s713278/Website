import { create } from 'zustand'
import { onExplicitSignOut } from '@/shared/auth/store/auth-store'
import { createEmptyOnboardingDraft, createEmptyRuntimeState } from '../data/onboarding-defaults'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import type { MeasurementCatalog } from '../lib/onboarding-measurement'
import { onboardingDraftAdapter } from '../lib/onboarding-adapter'
import { purgeLegacyOnboardingDrafts } from '../lib/onboarding-draft-keys'
import {
  cancelScheduledDraftSave,
  flushScheduledDraftSave,
  reconcilePersistedDraft,
  scheduleDraftSave,
  toPersistedDraft,
} from '../lib/onboarding-persistence'
import {
  ONBOARDING_CONFIG,
  ONBOARDING_DRAFT_VERSION,
  type CatalogSource,
  type StoreSubmission,
  type LocalPreviewSnapshotV1,
  type OnboardingPersistenceStatus,
  type OnboardingRuntimeState,
  type OnboardingStep,
  type VendorOnboardingDraftV1,
  type VendorOnboardingPersistedEnvelopeV1,
} from '../types/onboarding'

type ImageKind = 'logo' | 'banner'

type AccountCatalog = { categoryIds: number[]; productIds: number[] }

/**
 * The account catalog and the questions asked of it, built together.
 *
 * The predicates close over the catalog instead of reading it back through `get()`
 * because a step subscribes to one *by identity*. A `get()` closure would read fresh
 * state but be the same reference for the store's lifetime, so a step already on screen
 * would never re-render and would keep painting the catalog it first saw — which is what
 * happens when the account read lands after the step mounts.
 *
 * The invariant that buys: every write of `accountCatalog` must go through here, so the
 * predicates are rebuilt with it. A bare `set({ accountCatalog })` elsewhere leaves them
 * answering for the previous catalog, and nothing would fail to compile.
 */
function accountCatalogSlice(catalog: AccountCatalog) {
  return {
    accountCatalog: catalog,
    isCategoryAssigned: (categoryId: number) => catalog.categoryIds.includes(categoryId),
    isProductAssigned: (productId: number) => catalog.productIds.includes(productId),
  }
}

const EMPTY_ACCOUNT_CATALOG: AccountCatalog = { categoryIds: [], productIds: [] }

/** Adds what is new, and returns `current` untouched when nothing is. */
function mergeIds(current: number[], added: number[] | undefined): number[] {
  const missing = added?.filter((id) => !current.includes(id)) ?? []
  return missing.length ? [...current, ...missing] : current
}

type OnboardingStore = {
  draft: VendorOnboardingDraftV1
  runtime: OnboardingRuntimeState
  furthestVisitedStep: OnboardingStep
  previewSnapshot: LocalPreviewSnapshotV1 | null
  previewRestored: boolean
  persistenceInitialized: boolean
  persistenceStatus: OnboardingPersistenceStatus
  persistenceRevision: number
  persistenceUpdatedAt: string | null
  recoveryMessage: string | null
  pendingConflict: VendorOnboardingPersistedEnvelopeV1 | null
  /** Vendor the current draft belongs to; `null` before verification. */
  draftOwnerId: string | null
  /**
   * The draft holds edits that have not reached the vendor account.
   *
   * Cleared whenever the two agree — after a resume, and after a step is written on
   * Continue. While it is `false` the wizard re-reads the account on entry, so the
   * account stays the record and a stale local copy cannot outlive one visit.
   */
  hasLocalEdits: boolean
  /** Attribute the draft to the signed-in vendor, discarding anything owned by another. */
  setDraftOwner: (ownerId: string | null) => void
  /** Explicit sign-out: the vendor is done with this browser's draft. */
  abandonDraft: () => void
  /** Live plan limit from vendor context; falls back to the configured default. */
  categoryLimit: number
  setCategoryLimit: (limit: number | null) => void
  /**
   * Platform measurement catalog for Step 6 units. Defaults to the sample catalog so demo
   * mode and a failed live fetch still offer real units; the entry read replaces it.
   */
  measurementCatalog: MeasurementCatalog
  setMeasurementCatalog: (catalog: MeasurementCatalog) => void
  /** Account-confirmed store submission; not persisted. */
  storeSubmission: StoreSubmission | null
  setStoreSubmission: (submission: StoreSubmission | null) => void
  /**
   * Platform IDs already assigned on the vendor's account.
   *
   * Category and product assignment is additive for a vendor — there is no un-assign
   * they are allowed to call — so anything listed here cannot be taken back off the
   * store, and the wizard must not offer to. Not persisted: it describes the account,
   * not the draft.
   */
  accountCatalog: AccountCatalog
  setAccountCatalog: (catalog: AccountCatalog) => void
  /** Whether the account already holds this platform category. */
  isCategoryAssigned: (categoryId: number) => boolean
  /** Whether the account already holds this platform product. */
  isProductAssigned: (productId: number) => boolean
  /**
   * Record that the account now holds these platform categories and products.
   *
   * Assignment is additive, so this only ever grows the catalog. It is for writes that
   * have already succeeded: the account is still re-read on entry, and that read stays
   * the reconciliation.
   */
  recordAssignment: (assignment: Partial<AccountCatalog>) => void
  initializePersistence: (ownerId: string | null) => void
  flushPersistence: () => void
  loadNewerDraft: () => void
  overwriteWithCurrentDraft: () => void
  clearCorruptDraft: () => void
  updateDraft: (
    updater: (draft: VendorOnboardingDraftV1) => VendorOnboardingDraftV1,
    invalidateFrom?: OnboardingStep,
  ) => void
  updateRuntime: (patch: Partial<OnboardingRuntimeState>, invalidateFrom?: OnboardingStep) => void
  updatePhone: (phone: string) => void
  setImage: (kind: ImageKind, file: File | null, url: string | null) => void
  /**
   * Advance past `step`. `syncedWithAccount` says whether the step actually reached the
   * vendor account — false for demo and sample mode, where the write is deliberately
   * skipped. Defaults to true so identity Steps 1-2, which have nothing to persist, keep
   * letting the account read hydrate.
   */
  completeStep: (
    step: OnboardingStep,
    nextStep: OnboardingStep,
    options?: { syncedWithAccount?: boolean },
  ) => void
  goToStep: (step: OnboardingStep) => void
  completePrototype: (draftSlug: string) => void
  /** Steps 1-2 already satisfied by an existing vendor session. */
  adoptVerifiedSession: (maskedPhone: string | null) => void
  /** Replace the draft with what the vendor's account already holds. */
  applyResumedDraft: (
    draft: VendorOnboardingDraftV1,
    furthestVisitedStep: OnboardingStep,
    runtime: Pick<OnboardingRuntimeState, 'paymentDetails' | 'orderWhatsapp'>,
  ) => void
  /** Session lost while the draft claimed a verified number — reopen Step 1. */
  revokeVerifiedSession: () => void
  reset: () => void
}

let unsubscribeFromStorage: (() => void) | null = null

const FOREIGN_DRAFT_MESSAGE =
  'This browser held onboarding progress for a different store, so it was discarded. Setup already saved to your account is unaffected.'
const SIGNED_OUT_MESSAGE =
  'Signing out cleared the onboarding draft saved in this browser.'
const DEFERRED_MESSAGE =
  'Your session ended before this browser draft could be claimed. Verify the same number to pick up where you left off.'

function revokeRuntimeUrls(runtime: OnboardingRuntimeState) {
  if (typeof URL === 'undefined') return
  if (runtime.logoUrl) URL.revokeObjectURL(runtime.logoUrl)
  if (runtime.bannerUrl) URL.revokeObjectURL(runtime.bannerUrl)
}

function constrainVisitedStep(
  furthestVisitedStep: OnboardingStep,
  invalidateFrom: OnboardingStep | undefined,
): OnboardingStep {
  return invalidateFrom
    ? Math.min(furthestVisitedStep, invalidateFrom) as OnboardingStep
    : furthestVisitedStep
}

function invalidateDraft(
  draft: VendorOnboardingDraftV1,
  from: OnboardingStep | undefined,
): VendorOnboardingDraftV1 {
  if (!from) return draft
  const completedSteps = draft.completedSteps.some((step) => step >= from)
    ? draft.completedSteps.filter((step) => step < from)
    : draft.completedSteps
  const publication = from <= 9 && draft.publication.state !== 'draft'
    ? { state: 'draft' as const, draftSlug: null, completedAt: null }
    : draft.publication
  const currentStep = Math.min(draft.currentStep, from) as OnboardingStep

  if (
    completedSteps === draft.completedSteps &&
    publication === draft.publication &&
    currentStep === draft.currentStep
  ) return draft
  return { ...draft, currentStep, completedSteps, publication }
}

function restorationMessage(draft: VendorOnboardingDraftV1): string {
  if (!draft.mobileVerified) {
    return 'Draft restored. Enter your WhatsApp number to continue.'
  }
  return 'Draft restored. Private contact and payment details, OTPs, and images are not saved.'
}

/** Draft state with nothing restored. Ownership is carried through deliberately. */
function emptyDraftState(
  ownerId: string | null,
  persistenceStatus: OnboardingPersistenceStatus,
  recoveryMessage: string | null,
): Partial<OnboardingStore> {
  return {
    draft: createEmptyOnboardingDraft(),
    runtime: createEmptyRuntimeState(),
    furthestVisitedStep: 1,
    previewSnapshot: null,
    previewRestored: false,
    persistenceInitialized: true,
    persistenceStatus,
    persistenceRevision: 0,
    persistenceUpdatedAt: null,
    recoveryMessage,
    pendingConflict: null,
    storeSubmission: null,
    ...accountCatalogSlice(EMPTY_ACCOUNT_CATALOG),
    draftOwnerId: ownerId,
    hasLocalEdits: false,
  }
}

/**
 * Keep the stored draft but take it off the screen, because no one is signed in to
 * claim it. Anything queued is written first, so the work that is set aside is current.
 */
function deferDraft(ownerId: string | null): void {
  flushPendingSave()
  revokeRuntimeUrls(useOnboardingStore.getState().runtime)
  useOnboardingStore.setState(emptyDraftState(ownerId, 'deferred', DEFERRED_MESSAGE))
}

/** Drop the stored draft and start clean under `ownerId`. */
function discardDraft(ownerId: string | null, recoveryMessage: string | null): void {
  cancelScheduledDraftSave()
  revokeRuntimeUrls(useOnboardingStore.getState().runtime)
  let persistenceStatus: OnboardingPersistenceStatus = 'idle'
  try {
    onboardingDraftAdapter.drafts.clear()
  } catch {
    persistenceStatus = 'unavailable'
  }
  useOnboardingStore.setState(emptyDraftState(ownerId, persistenceStatus, recoveryMessage))
}

function applyPersistedEnvelope(
  envelope: VendorOnboardingPersistedEnvelopeV1,
  set: (partial: Partial<OnboardingStore>) => void,
) {
  revokeRuntimeUrls(useOnboardingStore.getState().runtime)
  const restored = reconcilePersistedDraft(envelope.draft, envelope.furthestVisitedStep)
  set({
    draft: restored.draft,
    runtime: createEmptyRuntimeState(),
    draftOwnerId: envelope.ownerId,
    furthestVisitedStep: restored.furthestVisitedStep,
    previewSnapshot: envelope.previewSnapshot,
    previewRestored: Boolean(envelope.previewSnapshot),
    // Envelopes written before this field existed are treated as holding unsaved work,
    // so restoring one never overwrites it with the account copy.
    hasLocalEdits: envelope.hasLocalEdits ?? true,
    persistenceInitialized: true,
    persistenceStatus: 'saved',
    persistenceRevision: envelope.revision,
    persistenceUpdatedAt: envelope.updatedAt,
    recoveryMessage: restorationMessage(restored.draft),
    pendingConflict: null,
  })
}

function isWritable(state: OnboardingStore): boolean {
  return (
    state.persistenceInitialized &&
    state.persistenceStatus !== 'conflict' &&
    state.persistenceStatus !== 'corrupt' &&
    state.persistenceStatus !== 'deferred'
  )
}

function persistCurrentDraft(): void {
  const state = useOnboardingStore.getState()
  if (!isWritable(state)) return

  const updatedAt = new Date().toISOString()
  const envelope: VendorOnboardingPersistedEnvelopeV1 = {
    version: ONBOARDING_DRAFT_VERSION,
    revision: state.persistenceRevision + 1,
    updatedAt,
    ownerId: state.draftOwnerId,
    furthestVisitedStep: state.furthestVisitedStep,
    hasLocalEdits: state.hasLocalEdits,
    draft: toPersistedDraft(state.draft),
    previewSnapshot: state.previewSnapshot,
  }
  try {
    onboardingDraftAdapter.drafts.write(envelope)
    useOnboardingStore.setState({
      persistenceStatus: 'saved',
      persistenceRevision: envelope.revision,
      persistenceUpdatedAt: updatedAt,
    })
  } catch {
    useOnboardingStore.setState({ persistenceStatus: 'unavailable' })
  }
}

function queuePersistence(): void {
  const state = useOnboardingStore.getState()
  if (!isWritable(state) || state.persistenceStatus === 'unavailable') return
  if (state.persistenceStatus !== 'saving') {
    useOnboardingStore.setState({ persistenceStatus: 'saving' })
  }
  scheduleDraftSave(persistCurrentDraft)
}

/**
 * Write a queued save now.
 *
 * `flushScheduledDraftSave(task)` arms the task even when nothing was scheduled, so this
 * must not be called speculatively: an unconditional write bumps the revision, wakes
 * every other tab's conflict dialog, and can recreate a draft that sign-out just removed.
 */
function flushPendingSave(): void {
  const state = useOnboardingStore.getState()
  if (!isWritable(state) || state.persistenceStatus !== 'saving') return
  flushScheduledDraftSave(persistCurrentDraft)
}

function flushPersistence(): void {
  flushPendingSave()
}

export type { CatalogSource }

/** The catalog the vendor is choosing from. */
export function selectCatalogSource(
  state: { draft: Pick<VendorOnboardingDraftV1, 'catalogSource'> },
): CatalogSource {
  return state.draft.catalogSource
}

/** Whether the draft may move from its current catalog source to `target`. */
export function selectCanSwitchCatalogSource(
  state: { draft: Pick<VendorOnboardingDraftV1, 'catalogSource' | 'completedSteps'> },
  target: CatalogSource,
): boolean {
  const current = selectCatalogSource(state)
  if (target === current) return false
  return target === 'account' || !state.draft.completedSteps.includes(3)
}

/**
 * Whether the vendor has sent their store for review.
 *
 * Read from `storeSubmission`, which only the account read and the submit call ever
 * fill — never from `draft.publication`, which lives in this browser and says
 * `prototype-complete` after a demo-mode walk that reached no account at all.
 *
 * Submission is not approval. A store awaiting an administrator is still submitted, and
 * still cannot be changed, so this stays true for both.
 */
export function selectStoreIsSubmitted(state: { storeSubmission: StoreSubmission | null }): boolean {
  return state.storeSubmission !== null
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  draft: createEmptyOnboardingDraft(),
  runtime: createEmptyRuntimeState(),
  furthestVisitedStep: 1,
  previewSnapshot: null,
  previewRestored: false,
  persistenceInitialized: false,
  persistenceStatus: 'loading',
  persistenceRevision: 0,
  persistenceUpdatedAt: null,
  recoveryMessage: null,
  pendingConflict: null,
  categoryLimit: ONBOARDING_CONFIG.maxCategories,
  measurementCatalog: SAMPLE_MEASUREMENT_CATALOG,
  storeSubmission: null,
  ...accountCatalogSlice(EMPTY_ACCOUNT_CATALOG),
  draftOwnerId: null,
  hasLocalEdits: false,

  setDraftOwner(ownerId) {
    const state = useOnboardingStore.getState()
    if (!state.persistenceInitialized) return

    if (state.persistenceStatus === 'deferred') {
      // An unclaimed draft is waiting. Only its owner may have it back.
      if (ownerId === null) return
      if (ownerId !== state.draftOwnerId) {
        discardDraft(ownerId, FOREIGN_DRAFT_MESSAGE)
        return
      }
      const result = onboardingDraftAdapter.drafts.read()
      if (result.kind === 'valid' && result.envelope.ownerId === ownerId) {
        applyPersistedEnvelope(result.envelope, set)
      } else {
        set({ persistenceStatus: 'idle', draftOwnerId: ownerId, recoveryMessage: null })
      }
      return
    }

    if (state.draftOwnerId === ownerId) return

    if (state.draftOwnerId === null) {
      // Steps 1-2 run before any vendor exists, so the draft they start is unowned
      // until verification names its owner.
      set({ draftOwnerId: ownerId })
      flushScheduledDraftSave(persistCurrentDraft)
      return
    }

    if (ownerId === null) {
      // The session ended without the vendor asking to leave — an expired token, a
      // failed refresh. That is not a decision to abandon work, so the draft is set
      // aside for them rather than deleted.
      deferDraft(state.draftOwnerId)
      return
    }

    // A different vendor is signed in. Keeping the draft would show the previous
    // vendor's selections and write them to this account.
    discardDraft(ownerId, FOREIGN_DRAFT_MESSAGE)
  },

  abandonDraft() {
    discardDraft(null, SIGNED_OUT_MESSAGE)
  },

  setStoreSubmission(submission) {
    set({ storeSubmission: submission })
  },

  setAccountCatalog(catalog) {
    set(accountCatalogSlice(catalog))
  },

  recordAssignment(assignment) {
    const { accountCatalog } = useOnboardingStore.getState()
    const categoryIds = mergeIds(accountCatalog.categoryIds, assignment.categoryIds)
    const productIds = mergeIds(accountCatalog.productIds, assignment.productIds)
    if (categoryIds === accountCatalog.categoryIds && productIds === accountCatalog.productIds) return
    set(accountCatalogSlice({ categoryIds, productIds }))
  },

  setCategoryLimit(limit) {
    set({ categoryLimit: limit && limit > 0 ? limit : ONBOARDING_CONFIG.maxCategories })
  },

  setMeasurementCatalog(catalog) {
    // An empty fetch keeps the sample fallback rather than emptying every Step 6 dropdown.
    set({ measurementCatalog: catalog.length ? catalog : SAMPLE_MEASUREMENT_CATALOG })
  },

  initializePersistence(ownerId) {
    purgeLegacyOnboardingDrafts()
    if (useOnboardingStore.getState().persistenceInitialized) {
      // The store outlives the wizard, so a remount can inherit an in-memory draft that
      // was read for a different identity. Re-check it rather than trusting the read.
      useOnboardingStore.getState().setDraftOwner(ownerId)
      return
    }
    const result = onboardingDraftAdapter.drafts.read()
    if (result.kind === 'valid' && result.envelope.ownerId !== ownerId && ownerId === null) {
      // Nobody is signed in, so there is no identity to check the draft against. It is
      // neither shown nor deleted until someone claims it.
      useOnboardingStore.setState(emptyDraftState(result.envelope.ownerId, 'deferred', DEFERRED_MESSAGE))
    } else if (result.kind === 'valid' && result.envelope.ownerId !== null && result.envelope.ownerId !== ownerId) {
      // A stored draft is private to the vendor who created it. This browser is now a
      // different identity, so the draft is dropped instead of resumed.
      discardDraft(ownerId, FOREIGN_DRAFT_MESSAGE)
    } else if (result.kind === 'valid') {
      // Either this vendor's own draft, or an unowned one started at Steps 1-2 before
      // they signed in. Both are theirs; adopting matches what setDraftOwner does when
      // the same thing happens without a reload.
      applyPersistedEnvelope(result.envelope, set)
      if (result.envelope.ownerId !== ownerId) useOnboardingStore.getState().setDraftOwner(ownerId)
    } else if (result.kind === 'empty') {
      set({ persistenceInitialized: true, persistenceStatus: 'idle', draftOwnerId: ownerId })
    } else if (result.kind === 'corrupt') {
      set({
        persistenceInitialized: true,
        persistenceStatus: 'corrupt',
        draftOwnerId: ownerId,
        recoveryMessage: 'The saved onboarding draft is unsupported or damaged.',
      })
    } else {
      set({ persistenceInitialized: true, persistenceStatus: 'unavailable', draftOwnerId: ownerId })
    }

    if (!unsubscribeFromStorage) {
      unsubscribeFromStorage = onboardingDraftAdapter.drafts.subscribe((envelope) => {
        const current = useOnboardingStore.getState()
        // A parked draft keeps its owner's id so they can reclaim it, but nobody is
        // signed in here. Offering it would put that vendor's draft on screen in a tab
        // with no session — the reclaim path re-reads storage anyway.
        if (current.persistenceStatus === 'deferred') return
        // Another tab signed in as a different vendor. That is not a newer version of
        // this draft, so it must never be offered as one.
        if (envelope.ownerId !== current.draftOwnerId) return
        const currentUpdatedAt = current.persistenceUpdatedAt ?? ''
        const isNewer = envelope.revision > current.persistenceRevision ||
          (envelope.revision === current.persistenceRevision && envelope.updatedAt > currentUpdatedAt)
        if (!isNewer) return
        cancelScheduledDraftSave()
        useOnboardingStore.setState({
          persistenceStatus: 'conflict',
          pendingConflict: envelope,
        })
      })
    }
  },

  flushPersistence,

  loadNewerDraft() {
    const conflict = useOnboardingStore.getState().pendingConflict
    if (conflict) applyPersistedEnvelope(conflict, set)
  },

  overwriteWithCurrentDraft() {
    const conflict = useOnboardingStore.getState().pendingConflict
    if (!conflict) return
    set({
      pendingConflict: null,
      persistenceRevision: conflict.revision,
      persistenceStatus: 'saving',
    })
    flushScheduledDraftSave(persistCurrentDraft)
  },

  clearCorruptDraft() {
    try {
      onboardingDraftAdapter.drafts.clear()
      set({
        persistenceStatus: 'idle',
        persistenceRevision: 0,
        persistenceUpdatedAt: null,
        recoveryMessage: null,
      })
    } catch {
      set({ persistenceStatus: 'unavailable' })
    }
  },

  updateDraft(updater, invalidateFrom) {
    set((state) => ({
      draft: invalidateDraft(updater(state.draft), invalidateFrom),
      furthestVisitedStep: constrainVisitedStep(state.furthestVisitedStep, invalidateFrom),
      // Edited here and not yet written to the account, so this copy now outranks it.
      hasLocalEdits: true,
      recoveryMessage: null,
    }))
    queuePersistence()
  },

  updateRuntime(patch, invalidateFrom) {
    set((state) => ({
      runtime: { ...state.runtime, ...patch },
      furthestVisitedStep: constrainVisitedStep(state.furthestVisitedStep, invalidateFrom),
      ...(invalidateFrom ? { draft: invalidateDraft(state.draft, invalidateFrom) } : {}),
      recoveryMessage: null,
    }))
    if (invalidateFrom) queuePersistence()
  },

  updatePhone(phone) {
    set((state) => ({
      runtime: { ...state.runtime, phone, otpDigits: ['', '', '', ''] },
      furthestVisitedStep: 1,
      draft: invalidateDraft(
        { ...state.draft, maskedPhone: null, mobileVerified: false },
        1,
      ),
      recoveryMessage: null,
    }))
    queuePersistence()
  },

  setImage(kind, file, url) {
    set((state) => {
      const oldUrl = kind === 'logo' ? state.runtime.logoUrl : state.runtime.bannerUrl
      if (oldUrl && oldUrl !== url) URL.revokeObjectURL(oldUrl)
      const runtime = kind === 'logo'
        ? { ...state.runtime, logoFile: file, logoUrl: url }
        : { ...state.runtime, bannerFile: file, bannerUrl: url }
      return {
        runtime,
        furthestVisitedStep: constrainVisitedStep(state.furthestVisitedStep, 9),
        draft: invalidateDraft(state.draft, 9),
      }
    })
    queuePersistence()
  },

  completeStep(step, nextStep, options = {}) {
    const { syncedWithAccount = true } = options
    set((state) => ({
      furthestVisitedStep: Math.max(state.furthestVisitedStep, nextStep) as OnboardingStep,
      // Only clear this when the step genuinely reached the account. Clearing it after a
      // skipped write tells the next account read that there is nothing local worth
      // keeping, and it overwrites work still visible on screen.
      hasLocalEdits: syncedWithAccount ? false : state.hasLocalEdits,
      draft: {
        ...state.draft,
        currentStep: nextStep,
        completedSteps: Array.from(new Set([...state.draft.completedSteps, step])).sort(
          (a, b) => a - b,
        ) as OnboardingStep[],
      },
    }))
    flushScheduledDraftSave(persistCurrentDraft)
  },

  goToStep(step) {
    set((state) => {
      const target = Math.min(step, state.furthestVisitedStep) as OnboardingStep
      return { draft: { ...state.draft, currentStep: target } }
    })
    flushScheduledDraftSave(persistCurrentDraft)
  },

  adoptVerifiedSession(maskedPhone) {
    set((state) => {
      const currentStep = Math.max(state.draft.currentStep, 3) as OnboardingStep
      // Re-running OTP would swap the signed-in vendor underneath the draft, so a
      // session that already exists can never rest on Steps 1-2.
      if (state.draft.mobileVerified && state.draft.currentStep === currentStep) return {}
      return {
        furthestVisitedStep: Math.max(state.furthestVisitedStep, 3) as OnboardingStep,
        draft: {
          ...state.draft,
          mobileVerified: true,
          maskedPhone: maskedPhone ?? state.draft.maskedPhone,
          currentStep,
          completedSteps: Array.from(new Set([...state.draft.completedSteps, 1, 2])).sort(
            (a, b) => a - b,
          ) as OnboardingStep[],
        },
      }
    })
    flushScheduledDraftSave(persistCurrentDraft)
  },

  applyResumedDraft(draft, furthestVisitedStep, runtime) {
    // A brand-new account resumes to an empty wizard, which is not something to
    // announce. Only say it when there was actually something to bring back.
    const restored = draft.categories.length > 0 || draft.products.length > 0
    set((state) => ({
      draft,
      furthestVisitedStep,
      runtime: {
        ...state.runtime,
        paymentDetails: runtime.paymentDetails,
        // Never persisted locally, so a resume is the only thing that can restore it.
        orderWhatsapp: runtime.orderWhatsapp || state.runtime.orderWhatsapp,
      },
      // This draft *is* the account copy.
      hasLocalEdits: false,
      recoveryMessage: restored
        ? 'Picked up where you left off, using the setup saved to your store.'
        : null,
    }))
    flushScheduledDraftSave(persistCurrentDraft)
  },

  revokeVerifiedSession() {
    set((state) => {
      if (!state.draft.mobileVerified) return {}
      return {
        furthestVisitedStep: 1,
        runtime: { ...state.runtime, otpDigits: ['', '', '', ''] },
        draft: {
          ...state.draft,
          mobileVerified: false,
          maskedPhone: null,
          currentStep: 1,
          completedSteps: [],
          publication: { state: 'draft', draftSlug: null, completedAt: null },
        },
      }
    })
    flushScheduledDraftSave(persistCurrentDraft)
  },

  completePrototype(draftSlug) {
    set((state) => {
      const completedDraft = onboardingDraftAdapter.complete(state.draft, draftSlug)
      const completedAt = completedDraft.publication.completedAt ?? new Date().toISOString()
      return {
        draft: completedDraft,
        previewSnapshot: {
          slug: draftSlug,
          completedAt,
          draft: toPersistedDraft(completedDraft),
        },
        previewRestored: false,
      }
    })
    flushScheduledDraftSave(persistCurrentDraft)
  },

  reset() {
    // Starting over is a choice by the signed-in vendor, so the draft stays theirs.
    discardDraft(useOnboardingStore.getState().draftOwnerId, null)
  },
}))

/**
 * Signing out abandons this browser's draft, on whatever route it happened.
 *
 * Registered at module scope, not from the wizard: this store outlives the wizard, so a
 * draft can still be in memory on a route that never mounts it. Clearing only storage
 * there would leave that copy behind, and the next visit would park it — writing it
 * straight back to the key sign-out had just removed.
 */
onExplicitSignOut(() => {
  useOnboardingStore.getState().abandonDraft()
})
