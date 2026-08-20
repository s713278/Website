import { create } from 'zustand'
import { createEmptyOnboardingDraft, createEmptyRuntimeState } from '../data/onboarding-defaults'
import { onboardingDraftAdapter } from '../lib/onboarding-adapter'
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
  type LocalPreviewSnapshotV1,
  type OnboardingPersistenceStatus,
  type OnboardingRuntimeState,
  type OnboardingStep,
  type VendorOnboardingDraftV1,
  type VendorOnboardingPersistedEnvelopeV1,
} from '../types/onboarding'

type ImageKind = 'logo' | 'banner'

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
  /** Live plan limit from vendor context; falls back to the configured default. */
  categoryLimit: number
  setCategoryLimit: (limit: number | null) => void
  initializePersistence: () => void
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
  completeStep: (step: OnboardingStep, nextStep: OnboardingStep) => void
  goToStep: (step: OnboardingStep) => void
  completePrototype: (draftSlug: string) => void
  /** Steps 1-2 already satisfied by an existing vendor session. */
  adoptVerifiedSession: (maskedPhone: string | null) => void
  /** Session lost while the draft claimed a verified number — reopen Step 1. */
  revokeVerifiedSession: () => void
  reset: () => void
}

let unsubscribeFromStorage: (() => void) | null = null

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

function applyPersistedEnvelope(
  envelope: VendorOnboardingPersistedEnvelopeV1,
  set: (partial: Partial<OnboardingStore>) => void,
) {
  revokeRuntimeUrls(useOnboardingStore.getState().runtime)
  const restored = reconcilePersistedDraft(envelope.draft, envelope.furthestVisitedStep)
  set({
    draft: restored.draft,
    runtime: createEmptyRuntimeState(),
    furthestVisitedStep: restored.furthestVisitedStep,
    previewSnapshot: envelope.previewSnapshot,
    previewRestored: Boolean(envelope.previewSnapshot),
    persistenceInitialized: true,
    persistenceStatus: 'saved',
    persistenceRevision: envelope.revision,
    persistenceUpdatedAt: envelope.updatedAt,
    recoveryMessage: restorationMessage(restored.draft),
    pendingConflict: null,
  })
}

function persistCurrentDraft(): void {
  const state = useOnboardingStore.getState()
  if (!state.persistenceInitialized || state.persistenceStatus === 'conflict' || state.persistenceStatus === 'corrupt') return

  const updatedAt = new Date().toISOString()
  const envelope: VendorOnboardingPersistedEnvelopeV1 = {
    version: ONBOARDING_DRAFT_VERSION,
    revision: state.persistenceRevision + 1,
    updatedAt,
    furthestVisitedStep: state.furthestVisitedStep,
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
  if (
    !state.persistenceInitialized ||
    state.persistenceStatus === 'conflict' ||
    state.persistenceStatus === 'corrupt' ||
    state.persistenceStatus === 'unavailable'
  ) return
  if (state.persistenceStatus !== 'saving') {
    useOnboardingStore.setState({ persistenceStatus: 'saving' })
  }
  scheduleDraftSave(persistCurrentDraft)
}

function flushPersistence(): void {
  const state = useOnboardingStore.getState()
  if (
    !state.persistenceInitialized ||
    state.persistenceStatus === 'conflict' ||
    state.persistenceStatus === 'corrupt' ||
    state.persistenceStatus === 'unavailable'
  ) return
  flushScheduledDraftSave(persistCurrentDraft)
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

  setCategoryLimit(limit) {
    set({ categoryLimit: limit && limit > 0 ? limit : ONBOARDING_CONFIG.maxCategories })
  },

  initializePersistence() {
    if (useOnboardingStore.getState().persistenceInitialized) return
    const result = onboardingDraftAdapter.drafts.read()
    if (result.kind === 'valid') {
      applyPersistedEnvelope(result.envelope, set)
    } else if (result.kind === 'empty') {
      set({ persistenceInitialized: true, persistenceStatus: 'idle' })
    } else if (result.kind === 'corrupt') {
      set({
        persistenceInitialized: true,
        persistenceStatus: 'corrupt',
        recoveryMessage: 'The saved onboarding draft is unsupported or damaged.',
      })
    } else {
      set({ persistenceInitialized: true, persistenceStatus: 'unavailable' })
    }

    if (!unsubscribeFromStorage) {
      unsubscribeFromStorage = onboardingDraftAdapter.drafts.subscribe((envelope) => {
        const current = useOnboardingStore.getState()
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

  completeStep(step, nextStep) {
    set((state) => ({
      furthestVisitedStep: Math.max(state.furthestVisitedStep, nextStep) as OnboardingStep,
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
      if (state.draft.mobileVerified) return {}
      return {
        furthestVisitedStep: Math.max(state.furthestVisitedStep, 3) as OnboardingStep,
        draft: {
          ...state.draft,
          mobileVerified: true,
          maskedPhone: maskedPhone ?? state.draft.maskedPhone,
          currentStep: Math.max(state.draft.currentStep, 3) as OnboardingStep,
          completedSteps: Array.from(new Set([...state.draft.completedSteps, 1, 2])).sort(
            (a, b) => a - b,
          ) as OnboardingStep[],
        },
      }
    })
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
    cancelScheduledDraftSave()
    revokeRuntimeUrls(useOnboardingStore.getState().runtime)
    let persistenceStatus: OnboardingPersistenceStatus = 'idle'
    try {
      onboardingDraftAdapter.drafts.clear()
    } catch {
      persistenceStatus = 'unavailable'
    }
    set({
      draft: createEmptyOnboardingDraft(),
      runtime: createEmptyRuntimeState(),
      furthestVisitedStep: 1,
      previewSnapshot: null,
      previewRestored: false,
      persistenceInitialized: true,
      persistenceStatus,
      persistenceRevision: 0,
      persistenceUpdatedAt: null,
      recoveryMessage: null,
      pendingConflict: null,
    })
  },
}))
