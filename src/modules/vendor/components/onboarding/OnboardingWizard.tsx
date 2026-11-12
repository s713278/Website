import { OnboardingFeedbackProvider } from './OnboardingFeedbackProvider'
import { useOnboardingFeedback } from './onboarding-feedback'
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DatabaseIcon,
  EyeIcon,
  InfoIcon,
  RotateCcwIcon,
  StoreIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  authService,
  getErrorMessage,
  isApiError,
  isLiveApi,
  vendorOnboardingService,
  type BusinessTypeReference,
  type MeasurementCatalog,
  type VendorContext,
  type VendorImageKind,
  type VendorProfile,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { LoadError } from '@/shared/components/LoadError'
import { StoreImageLoadNotice } from './StoreImageInput'
import { PageLoader } from '@/shared/components/PageLoader'
import { Button } from '@/shared/components/ui'
import { readCategoryReferenceFirstPage, readProductReferenceFirstPage } from '../../hooks/use-onboarding-catalog'
import { useOnboardingDraftSession } from '../../hooks/use-onboarding-draft-session'
import { canEnterCatalogSteps, navigationFloor } from '../../lib/onboarding-access'
import { peekMeasurementCatalog } from '../../lib/measurement-catalog-cache'
import { categoryReferenceCacheKey, productReferenceCacheKey, readReferenceCache } from '../../lib/onboarding-catalog-cache'
import {
  invalidateOnboardingResources,
  peekOnboardingResource,
  setOnboardingResource,
  type OnboardingResourceData,
} from '../../lib/onboarding-resource-cache'
import {
  accountResumeState,
  applyBusinessType,
  applyCategories,
  applyCheckout,
  applyProducts,
  applyProfile,
  applyResumeFrame,
  applySkus,
  applyStorefront,
  backendResumeStep,
  checkoutBaselines,
  derivedResumeStep,
  isStoreSubmitted,
  isVendorApproved,
  loadAccountResource,
  measurementCatalogsForResume,
  readTypeCategories,
  requiredStepResources,
  resumeOrderWhatsapp,
  resumePaymentDetails,
  resumeStorefrontWhatsapp,
  savedBusinessType,
  stepLoadState,
  stepResources,
  type OnboardingResource,
  type ResourceStatus,
} from '../../lib/onboarding-resume'
import { phonePreviewAccountParts, type PhonePreviewAccountParts } from '../../lib/phone-preview-catalog'
import { loadStepResources } from '../../lib/onboarding-server-state'
import { maskPhone } from '../../lib/onboarding-adapter'
import {
  GO_LIVE_RESOURCES,
  isLivePersistedStep,
  persistStep,
  resumedCatalogFingerprints,
  savedResources,
  stepErrorField,
  stepSaveFingerprint,
  stepsSavedTogether,
  writesReachAccount,
} from '../../lib/onboarding-sync'
import {
  checkoutWriteInput,
  isAccountStep,
  pendingEditIssues,
  pendingSteps,
  stepSnapshot,
  type AccountStep,
  type SavedBaselines,
} from '../../lib/onboarding-progress'
import {
  catalogDependencyGaps,
  stepAfterCatalogSave,
  stepsNeedingAttention,
} from '../../lib/onboarding-catalog-dependencies'
import {
  BUSINESS_TYPE_LOCKED_MESSAGE,
  resolveSavedType,
  savedTypeState,
  unresolvedTypeMessage,
  type SavedTypeResolution,
  type SavedTypeState,
  type TypeCategories,
} from '../../lib/onboarding-saved-type'
import { assignedCatalogIsMixed, dropOtherTypeSelections, MIXED_CATALOG_MESSAGE, mixedCatalogIssues } from '../../lib/onboarding-draft-repair'
import {
  RESOURCE_FIELDS,
  mergeAccountFields,
  pruneOrphans,
  stepFields,
  withSavedValues,
  withoutSteps,
  withUnknownEdits,
  type DraftField,
} from '../../lib/onboarding-draft-merge'
import {
  clearTypeSaveInFlight,
  markTypeSaveInFlight,
  readSavedTypeRecord,
  recordConfirmedType,
} from '../../lib/onboarding-saved-type-record'
import { createEmptyOnboardingDraft } from '../../data/onboarding-defaults'
import { ImageSaveError } from '../../lib/onboarding-images'
import { additiveCatalogIssues, normalizeDraftSlug, readinessIssues, validateStep } from '../../lib/onboarding-validation'
import { invalidateVendorContext, loadVendorContext, peekVendorContext, vendorContextIsCurrent } from '../../lib/vendor-context-cache'
import { mergeRuntimeRecord, mergeRuntimeValue, revalidationReads } from '../../lib/onboarding-freshness'
import { pageAwayEpoch } from '../../lib/page-away'
import {
  continueWithCatalogPolicy,
  selectCatalogPolicy,
  selectCatalogSource,
  selectCategoryLimit,
  selectStoreIsApproved,
  selectStoreIsSubmitted,
  useOnboardingStore,
} from '../../store/onboarding-store'
import {
  ONBOARDING_STEPS,
  isAdditiveCatalogStep,
  type OnboardingStep,
  type ValidationIssue,
} from '../../types/onboarding'
import { AccessNotice, OnboardingStatus, StepNotice } from './AccessNotice'
import { BusinessStep, CategoryStep, ProductStep } from './CatalogSteps'
import { ConfirmDialog, type ConfirmDialogState } from './ConfirmDialog'
import { OtpSentTo, OtpStep, PhoneStep } from './IdentitySteps'
import { DeliveryStep, PaymentStep, SkuStep } from './OperationsSteps'
import { OnboardingStepper } from './OnboardingStepper'
import { ReviewStep, StorefrontStep } from './StoreSteps'
import { StorefrontPreview } from './StorefrontPreview'
import { PreviewStats } from './PreviewStats'
import type { RequestConfirmation } from './StepPrimitives'

const EMPTY_CONFIRM: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  confirmLabel: 'Continue',
  onConfirm: () => undefined,
}

function LivePreviewPane({ accountParts }: { accountParts: PhonePreviewAccountParts }) {
  const draft = useOnboardingStore((state) => state.draft)
  const logoUrl = useOnboardingStore((state) => state.runtime.logoUrl)
  const bannerUrl = useOnboardingStore((state) => state.runtime.bannerUrl)
  const deferredDraft = useDeferredValue(draft)
  return <StorefrontPreview onboardingBranding draft={deferredDraft} logoUrl={logoUrl} bannerUrl={bannerUrl} accountParts={accountParts} />
}

/** The bay where the shop takes shape: the storefront as a customer will see it. */
function PhonePreviewStage({ className, id, labelledBy }: { className?: string; id?: string; labelledBy?: string }) {
  const catalogSource = useOnboardingStore(selectCatalogSource)
  const catalogPreview = useOnboardingStore((state) => state.catalogPreview)
  const loadedSteps = useOnboardingStore((state) => state.loadedSteps)
  const editedSteps = useOnboardingStore((state) => state.editedSteps)
  const accountParts = useMemo(
    () => phonePreviewAccountParts({ catalogSource, catalogPreview, loadedSteps, editedSteps }),
    [catalogSource, catalogPreview, loadedSteps, editedSteps],
  )
  return (
    <aside
      id={id}
      role={labelledBy ? 'tabpanel' : undefined}
      aria-labelledby={labelledBy}
      className={cn('onboarding-preview-stage relative min-h-0', className)}
      aria-label={labelledBy ? undefined : 'Storefront preview'}
    >
      <div className="flex w-[var(--phone-w)] shrink-0 items-center justify-center gap-2 text-[var(--ob-ink-soft)]">
        <StoreIcon className="size-3.5" aria-hidden="true" />
        <span className="ob-eyebrow">Live preview</span>
      </div>
      <LivePreviewPane accountParts={accountParts} />
      <PreviewStats className="shrink-0" accountParts={accountParts} />
    </aside>
  )
}

/**
 * Step 4 also waits for its first category page, and Step 5 for its default panel's first
 * product page, so saved and listed choices paint together. A failed page does not hold
 * the step: the step's own list reads it again and shows a second failure.
 */
function waitsForFirstList(
  state: 'loading' | 'failed' | 'loaded',
  step: OnboardingStep,
  view: AccountLoadView,
): 'loading' | 'failed' | 'loaded' {
  const list = step === 4 ? view.categoryList : step === 5 ? view.productPanel : 'loaded'
  return state === 'loaded' && (list === 'idle' || list === 'loading') ? 'loading' : state
}

type OnboardingState = ReturnType<typeof useOnboardingStore.getState>

/**
 * Recomputes, from the store as it is now, the issues a validation reported on Continue.
 * Only validation-origin issues carry one; a server or request failure has nothing to
 * re-run, so it stays until the next action.
 */
type IssueRecheck = (state: OnboardingState) => ValidationIssue[]

/** `toastOnly` issues are announced by the toast alone: they have no inline message. */
type ShownIssues = { issues: ValidationIssue[]; recheck?: IssueRecheck; toastOnly?: boolean }

const NO_ISSUES: ShownIssues = { issues: [] }
const NO_INLINE_ISSUES: ValidationIssue[] = []

/**
 * Steps whose Continue problems sit beside one specific field, so the inline message says
 * everything and a toast would repeat it. Steps 3-5 are the opposite: a missing choice has no
 * single field worth marking, so the toast carries it. Step 10 lists its issues itself and keeps
 * its toast.
 */
const INLINE_ONLY_STEPS: readonly OnboardingStep[] = [1, 2, 6, 7, 8, 9]
// The "Choose …" messages are the missing choices. Plan-limit messages share the `categories` and
// `products` fields but are guidance the vendor must keep seeing, so they stay inline.
const isMissingChoice = (item: ValidationIssue) => item.message.startsWith('Choose ')

const ACCOUNT_RESOURCES: readonly OnboardingResource[] = ['profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout', 'logo', 'banner', 'storefront']
/** The steps whose draft each resource's applier fills. */
const RESOURCE_STEPS: Record<OnboardingResource, readonly OnboardingStep[]> = {
  profile: [3, 9], businessTypes: [3], categories: [4], products: [5], skus: [6], checkout: [7, 8], logo: [9], banner: [9], storefront: [9],
}

const ACCOUNT_STEPS: readonly OnboardingStep[] = [3, 4, 5, 6, 7, 8, 9]

/**
 * Clear what an account write made stale in the shared caches: the written resources and the
 * vendor context (it carries `next_step`, plan usage and store state). Business types and
 * units are platform data, so they stay.
 */
function dropWrittenAccountData(vendorId: string, resources: readonly OnboardingResource[]) {
  invalidateOnboardingResources(vendorId, resources)
  invalidateVendorContext(vendorId)
}

/**
 * Where this visit's account reads stand: the context, each resource and the units, and
 * the first reference page Step 4 or Step 5 shows, which is read alongside them.
 */
type AccountLoadView = {
  context: ResourceStatus
  resources: Record<OnboardingResource, ResourceStatus>
  units: ResourceStatus
  categoryList: ResourceStatus
  productPanel: ResourceStatus
}

const IDLE_LOAD_VIEW: AccountLoadView = {
  context: 'idle',
  resources: {
    profile: 'idle', businessTypes: 'idle', categories: 'idle', products: 'idle', skus: 'idle', checkout: 'idle', logo: 'idle', banner: 'idle', storefront: 'idle',
  },
  units: 'idle',
  categoryList: 'idle',
  productPanel: 'idle',
}

type AccountEntry = {
  /** Start, or join, whatever the step needs that this visit has not read yet. */
  requestStep: (step: OnboardingStep) => void
  /** Start the step's account reads ahead of it opening, without touching this visit's view. */
  prefetchStep: (step: OnboardingStep) => void
  /** Re-read the context if it failed, and the step's failed resources. */
  retry: (step: OnboardingStep) => void
  retryImage: (kind: VendorImageKind) => void
  recordImage: (kind: VendorImageKind, url: string) => void
  /** A Step 3 save of `type` was confirmed: it is the saved type from now on. */
  confirmSavedType: (type: BusinessTypeReference) => void
  /** Work the saved type out again from a fresh context and vendor record. */
  recheckSavedType: () => void
  /** Whether a write from the step must read the account again first: the page has been away since. */
  isStale: (step: OnboardingStep) => boolean
  /** Read again what a write from the step is built from, and merge it in (`onboarding-freshness`). */
  revalidate: (step: OnboardingStep) => Promise<RevalidationOutcome>
  cancel: () => void
}

/**
 * `current`: the write may go ahead on what the draft now holds. `blocked`: the account moved on
 * in a way the visit is still catching up with (a type to settle, or a new entry), so not now.
 */
type RevalidationOutcome = { kind: 'current' } | { kind: 'blocked' } | { kind: 'failed'; error: unknown } | { kind: 'ended' }

/**
 * Whether the account changed beyond what a merge applies: submission, or a submitted store's
 * approval, which decide what is editable and where the wizard opens. Judged against what the
 * wizard holds, which this tab's own submission also updates. The visit then starts again.
 */
function accountStatusChanged(state: OnboardingState, next: VendorContext): boolean {
  const submitted = isStoreSubmitted({ context: next })
  return selectStoreIsSubmitted(state) !== submitted
    || (submitted && selectStoreIsApproved(state) !== isVendorApproved({ context: next }))
}

/**
 * Whether the account counts Step 3 as saved. The context is current after a write, so its
 * `next_step` decides; without one, only a named business type on the vendor record does.
 */
function stepThreeSaved(context: VendorContext, profile: VendorProfile | null, submitted: boolean): boolean {
  if (submitted || isStoreSubmitted({ context })) return true
  const next = context.onboarding.nextStep
  if (next != null && Number.isInteger(next)) return next > 3
  return savedBusinessType(profile) !== null
}

/** Steps that show or check the saved type, and so read the evidence for it when needed. */
function stepNeedsSavedType(step: OnboardingStep, submitted: boolean): boolean {
  return step === 3 || step === 4 || (step === 10 && !submitted)
}

/**
 * One wizard visit's reads of the vendor's account, applied to the draft as each lands.
 *
 * The context and the profile are read at once; every other resource only when a step
 * that needs it opens. Each result is applied the moment it lands, whatever step is on
 * screen, through the per-resource appliers, merged field by field with unsaved edits
 * (`mergeAccountFields`); a submitted store takes the account's copy everywhere. Nothing is
 * applied without a context. A result for a visit that
 * has ended, or for another vendor, is dropped.
 */
function startAccountEntry(
  vendorId: string,
  hooks: {
    setView: (view: AccountLoadView) => void
    setContextError: (message: string | null) => void
    savedSteps: { current: Partial<Record<OnboardingStep, string>> }
    /** Start the visit again, as on entry. */
    restart: () => void
  },
): AccountEntry {
  let cancelled = false
  const view: AccountLoadView = { ...IDLE_LOAD_VIEW, resources: { ...IDLE_LOAD_VIEW.resources } }
  const values: Partial<OnboardingResourceData> = {}
  // `undefined` while unsettled; `null` after a failed read, which falls back to sample units.
  let units: MeasurementCatalog | null | undefined
  const applied = new Set<OnboardingResource>()
  const versions: Partial<Record<OnboardingResource | 'units', number>> = {}
  const vouched = new Set<OnboardingStep>()
  let context: VendorContext | null = null
  // The away count (`page-away`) each applied read started in; an older one predates an away.
  let contextReadAt = -1
  const readAt: Partial<Record<OnboardingResource, number>> = {}
  // While a revalidation applies fresh reads: the saved baselines from before them, against
  // which runtime-only values (payment details, WhatsApp numbers) are merged.
  let priorBaselines: SavedBaselines | null = null
  // The account's WhatsApp numbers from a storefront read a revalidation applied.
  let accountWhatsapp: { orderWhatsapp: string; supportWhatsapp: string } | null = null
  // The step the account resumes at, which bounds the steps a resume vouches for.
  let resumeAt: OnboardingStep | null = null
  // No usable pointer: the step is derived once every resource has been read.
  let derivePending = false
  let storeDetailsBaselined = false
  // Step 4 or 5 is open, so its first list page is wanted; and the list each was read for.
  let categoryListWanted = false
  let categoryListKey: string | null = null
  let productPanelWanted = false
  let productPanelKey: string | null = null
  // The saved business type (`resolveSavedType`), worked out once the profile and the business
  // types have landed. The category evidence costs a read per business type, so it is read only
  // once a step that needs the type opens; until then the type stays unknown.
  let typeOutcome: Exclude<SavedTypeResolution, { kind: 'needs' }> | null = null
  let typeApplied = false
  let typeWanted = false
  let typeRechecks = 0
  // A recheck's fresh context and vendor record, used for the saved type alone.
  let typeFresh: { context: VendorContext; profile: VendorProfile | null } | null = null
  let typeRecheck: 'idle' | 'loading' | 'failed' = 'idle'
  let recheckVersion = 0
  let typeLists: { status: 'idle' | 'loading' | 'loaded' | 'failed'; lists?: TypeCategories[] } = { status: 'idle' }
  let typeListsVersion = 0
  // The saved type a restored draft's catalog was last repaired against (`dropOtherTypeSelections`).
  let repairedFor: number | null = null
  // A business type's whole category list, when this visit's own Step 4 first-page read
  // returned it complete. Evidence for `checkCatalogMixed`; a cached page is not.
  let shownTypeList: { typeId: number; categoryIds: number[] } | null = null

  const store = () => useOnboardingStore.getState()
  const isCurrent = () => !cancelled && useAuthStore.getState().user?.vendorId === vendorId
  const publish = () => hooks.setView({ ...view, resources: { ...view.resources } })

  const landValue = <R extends OnboardingResource>(resource: R, value: OnboardingResourceData[R], at = pageAwayEpoch()) => {
    if (view.resources[resource] === 'loaded') return
    values[resource] = value
    readAt[resource] = at
    view.resources[resource] = 'loaded'
    // What the account holds counts against the plan limits whatever the draft says.
    if (resource === 'categories') {
      store().setAccountCatalog({ categoryIds: values.categories!.map((category) => category.platformCategoryId) })
    } else if (resource === 'products') {
      store().setAccountCatalog({ productIds: values.products!.map((product) => product.platformProductId) })
    } else if (resource === 'skus') {
      store().setAccountCatalog({ skuIds: values.skus!.map((sku) => sku.skuId) })
    }
  }

  const settleUnits = (catalog: MeasurementCatalog | null) => {
    units = catalog
    view.units = catalog ? 'loaded' : 'failed'
    // A failed read keeps sample units for sizes and no product measurement metadata.
    const catalogs = measurementCatalogsForResume(catalog)
    store().setMeasurementCatalog(catalogs.measurements)
    store().setProductMeasurementCatalog(catalogs.productMeasurementCatalog)
  }

  /**
   * Open where the account says and count what it says is done. Unsaved local edits keep
   * their sections (the appliers leave them alone) but never decide the step or progress.
   */
  const applyFrame = (openAt: OnboardingStep) => {
    const state = store()
    const submitted = selectStoreIsSubmitted(state)
    const edited = new Set(state.editedSteps)
    const draft = applyResumeFrame(state.draft, openAt, { edited, submitted })
    state.applyResumedDraft(
      draft,
      openAt,
      { paymentDetails: state.runtime.paymentDetails },
      { frameApplied: true, editsKept: edited.size > 0 && !submitted },
    )
  }

  /**
   * Every applier whose inputs have landed and that has not run yet, in one draft write. Each
   * read is merged with the draft's unsaved fields it can tell (`mergeAccountFields`), as it
   * lands: a read still on its way leaves its fields as they are.
   */
  const applyReady = () => {
    if (!context) return
    const state = store()
    const submitted = selectStoreIsSubmitted(state)
    const approved = selectStoreIsApproved(state)
    // An edited step with no fields of its own (an old-format draft) has no known saved values.
    let edits = withUnknownEdits(state.fieldEdits, state.editedSteps)
    let draft = state.draft
    let paymentDetails = state.runtime.paymentDetails
    let orderWhatsapp: string | undefined
    let supportWhatsapp: string | undefined
    const ran = (resource: OnboardingResource) => applied.add(resource)
    // Each step's saved values, as the account copy alone would set them: what pending
    // edits are measured against, whether or not the step kept its local copy.
    const baselines: SavedBaselines = {}
    const accountOnly = { edited: new Set<OnboardingStep>(), submitted }
    const empty = createEmptyOnboardingDraft()
    const merge = (account: OnboardingState['draft'], fields: readonly DraftField[], accountEmpty = false) => {
      const merged = mergeAccountFields({ local: draft, account, fields, edits, submitted, accountEmpty })
      draft = merged.draft
      edits = merged.edits
    }
    const stillEdited = (step: AccountStep) => !submitted && stepFields(step).some((field) => edits[field])

    if (!applied.has('profile') && view.resources.profile === 'loaded') {
      merge(applyProfile(draft, values.profile!, accountOnly, context.businessName), RESOURCE_FIELDS.profile)
      // Not on a revalidation: the vendor record can be served stale after a write.
      if (!stillEdited(9) && !priorBaselines) orderWhatsapp = resumeOrderWhatsapp(values.profile!) || undefined
      ran('profile')
    }
    // Profile resets new-store branding, so the saved storefront applies only after it.
    if (!applied.has('storefront') && view.resources.storefront === 'loaded' && applied.has('profile')) {
      merge(applyStorefront(draft, values.storefront!), RESOURCE_FIELDS.storefront)
      const numbers = resumeStorefrontWhatsapp(values.storefront!)
      const prior = priorBaselines?.[9]
      orderWhatsapp = priorBaselines ? mergeRuntimeValue(state.runtime.orderWhatsapp, prior?.orderWhatsapp, numbers.orderWhatsapp) : numbers.orderWhatsapp
      supportWhatsapp = priorBaselines ? mergeRuntimeValue(state.runtime.supportWhatsapp, prior?.supportWhatsapp, numbers.supportWhatsapp) : numbers.supportWhatsapp
      if (priorBaselines) accountWhatsapp = numbers
      ran('storefront')
    }
    const businessType = settleType()
    let typeState: SavedTypeState | null = null
    if (typeOutcome && !typeApplied) {
      typeApplied = true
      // An unresolved type is unknown: Step 3 keeps its copy and has no saved value.
      if (typeOutcome.kind !== 'unresolved') {
        const saved = typeOutcome.kind === 'saved' ? typeOutcome.type : typeOutcome.preselect
        // A saved type is locked, so it replaces any unsaved choice; an open one is only a
        // preselection, which an unsaved choice outranks.
        if (typeOutcome.kind === 'saved') {
          draft = applyBusinessType(draft, saved, { ...accountOnly, locked: true })
          edits = withoutSteps(edits, [3])
        } else {
          merge(applyBusinessType(draft, saved, accountOnly), RESOURCE_FIELDS.businessType, true)
        }
        baselines[3] = { businessType: saved }
      }
      typeState = savedTypeState(typeOutcome, typeRechecks > 0)
      settleTypeSave(typeOutcome)
    }
    if (!applied.has('businessTypes') && businessType !== undefined) ran('businessTypes')
    if (!applied.has('categories') && view.resources.categories === 'loaded' && businessType !== undefined) {
      merge(applyCategories(draft, values.categories!, businessType, accountOnly), RESOURCE_FIELDS.categories)
      baselines[4] = { categories: applyCategories(empty, values.categories!, businessType, accountOnly).categories }
      ran('categories')
    }
    if (!applied.has('products') && view.resources.products === 'loaded') {
      merge(applyProducts(draft, values.products!, accountOnly), RESOURCE_FIELDS.products)
      baselines[5] = { products: applyProducts(empty, values.products!, accountOnly).products }
      ran('products')
    }
    // Saved sizes are rebuilt against the units, so they wait for them (or their fallback).
    if (!applied.has('skus') && view.resources.skus === 'loaded' && view.resources.products === 'loaded' && units !== undefined) {
      const measurements = measurementCatalogsForResume(units).measurements
      merge(applySkus(draft, values.skus!, values.products!, measurements, accountOnly), RESOURCE_FIELDS.skus)
      baselines[6] = { skus: applySkus(empty, values.skus!, values.products!, measurements, accountOnly).skus }
      ran('skus')
    }
    if (!applied.has('checkout') && view.resources.checkout === 'loaded') {
      // No checkout saved yet: an old-format draft's delivery and payments may fill it.
      merge(applyCheckout(draft, values.checkout!, accountOnly), RESOURCE_FIELDS.checkout, values.checkout === null)
      const saved = checkoutBaselines(values.checkout!)
      if (priorBaselines) {
        paymentDetails = mergeRuntimeRecord(paymentDetails, priorBaselines[8]?.paymentDetails, saved[8]!.paymentDetails)
      } else if (!stillEdited(8)) paymentDetails = resumePaymentDetails(values.checkout!, paymentDetails)
      Object.assign(baselines, saved)
      ran('checkout')
    }
    // Local additions whose category or product left the draft go with it, once the parent
    // list has been merged.
    draft = pruneOrphans(draft, { products: applied.has('categories'), skus: applied.has('products') })
    for (const kind of ['logo', 'banner'] as const) {
      if (!applied.has(kind) && view.resources[kind] === 'loaded') {
        state.restoreImage(kind, values[kind]!)
        ran(kind)
      }
    }
    // A draft the old type change left can hold another type's unsaved catalog; once the
    // saved type and the assigned categories are known, those selections go, silently.
    if (typeOutcome?.kind === 'saved' && applied.has('categories') && repairedFor !== typeOutcome.type.id) {
      repairedFor = typeOutcome.type.id
      draft = dropOtherTypeSelections(draft, typeOutcome.type.id, state.accountCatalog)
    }
    if (draft !== state.draft || edits !== state.fieldEdits || paymentDetails !== state.runtime.paymentDetails || orderWhatsapp !== undefined || supportWhatsapp !== undefined) {
      state.applyResumedDraft(draft, state.furthestVisitedStep, { paymentDetails, orderWhatsapp, supportWhatsapp }, { frameApplied: false, edits })
    }
    if (typeState) store().setSavedType(typeState)
    // Step 9's branding is unreadable until approval, so its saved values are the store
    // details as applied, with each unsaved field's recorded saved value in its place; unknown
    // while an unsaved field records none (an old-format draft), so the step stays pending.
    if (!storeDetailsBaselined && applied.has('profile') && (!(submitted && approved) || applied.has('storefront'))) {
      storeDetailsBaselined = true
      const latest = store()
      const saved = withSavedValues(latest.draft, latest.fieldEdits, stepFields(9))
      // A revalidation keeps the saved WhatsApp numbers it knew, unless a storefront read
      // told new ones: the runtime may hold unsaved numbers.
      const prior = priorBaselines?.[9]
      const runtime = prior ? { ...latest.runtime, ...(accountWhatsapp ?? { orderWhatsapp: prior.orderWhatsapp, supportWhatsapp: prior.supportWhatsapp }) } : latest.runtime
      if (saved) baselines[9] = stepSnapshot(9, saved, runtime)
    }
    if (Object.keys(baselines).length) store().recordSavedBaselines(baselines)
    checkCatalogMixed()

    if (derivePending && requiredStepResources(10, { submitted, approved }).every((resource) => applied.has(resource))) {
      derivePending = false
      resumeAt = derivedResumeStep(accountResumeState(context, values as OnboardingResourceData))
      // Only while the vendor is still where the fallback put them.
      if (store().draft.currentStep === 10) applyFrame(resumeAt)
    }

    // Step 3 shares Step 9's required reads. Do not mark store details restored before
    // their own reads have started; optional images may still be loading or failed.
    const storeReadsStarted = view.resources.logo !== 'idle' && view.resources.banner !== 'idle'
    const loadedSteps = ACCOUNT_STEPS.filter((step) => (step !== 9 || storeReadsStarted)
      && requiredStepResources(step, { submitted, approved }).every((resource) => applied.has(resource)))
    store().setLoadedSteps(loadedSteps)
    const imageReadsSettled = (['logo', 'banner'] as const).every((kind) => view.resources[kind] === 'loaded' || view.resources[kind] === 'failed')
    if (submitted && approved && loadedSteps.includes(9) && imageReadsSettled && !vouched.has(9)) {
      vouched.add(9)
      if (!store().editedSteps.includes(9)) {
        hooks.savedSteps.current[9] = stepSaveFingerprint(9, store().draft, store().runtime) ?? undefined
      }
    }

    // A catalog step before the resume step, taken whole from the account (with every
    // catalog step before it), already matches it: its Continue need not save again.
    if (resumeAt === null) return
    const latest = store()
    const edited = new Set(latest.editedSteps)
    const fromAccount = new Set(loadedSteps.filter((step) => submitted || !edited.has(step)))
    const prints = resumedCatalogFingerprints(latest.draft, resumeAt, fromAccount)
    for (const step of [4, 5, 6] as const) {
      const print = prints[step]
      if (!print || vouched.has(step)) continue
      vouched.add(step)
      // A save this visit already set the step's fingerprint; it stands.
      if (hooks.savedSteps.current[step]) continue
      hooks.savedSteps.current[step] = print
    }
  }

  /**
   * Whether the assigned catalog is confirmed mixed (`assignedCatalogIsMixed`). Only this
   * visit's own reads count: the assigned categories as read on entry, never what a save adds
   * later, against a complete category list of the saved type this visit read anyway (the
   * saved-type fallback's lists, or Step 4's first page when it is the last). Nothing is read
   * for this check alone.
   */
  const checkCatalogMixed = () => {
    const state = store()
    if (typeOutcome?.kind !== 'saved' || view.resources.categories !== 'loaded' || state.catalogMixed || selectStoreIsSubmitted(state)) return
    const typeId = typeOutcome.type.id
    const listed = typeLists.lists?.find(({ type }) => type.id === typeId)?.categoryIds
      ?? (shownTypeList?.typeId === typeId ? shownTypeList.categoryIds : undefined)
    const assigned = values.categories!.map((category) => category.platformCategoryId)
    if (assignedCatalogIsMixed(assigned, listed)) state.setCatalogMixed(true)
  }

  /**
   * The business type the account's Step 3 holds, as far as is known now: `undefined` while
   * it waits for a read, `null` for none or unknown. Sets `typeOutcome` once the evidence is in.
   * Without a step that needs the type, evidence still to be read leaves it unknown (`null`)
   * rather than holding the catalog steps back.
   */
  const settleType = (): BusinessTypeReference | null | undefined => {
    if (!context || view.resources.profile !== 'loaded' || view.resources.businessTypes !== 'loaded') return undefined
    if (!typeOutcome && typeRecheck === 'loading') return undefined
    if (!typeOutcome && typeRecheck === 'failed') typeOutcome = { kind: 'unresolved' }
    if (!typeOutcome) {
      const fresh = typeFresh ?? { context, profile: values.profile! }
      const resolution = resolveSavedType({
        confirmed: readSavedTypeRecord(vendorId).confirmed,
        stepSaved: stepThreeSaved(fresh.context, fresh.profile, selectStoreIsSubmitted(store())),
        profileTypeName: fresh.profile?.businessType ?? null,
        businessTypes: values.businessTypes!,
        assignedCategoryIds: view.resources.categories === 'loaded'
          ? values.categories!.map((category) => category.platformCategoryId)
          : undefined,
        typeCategories: typeLists.lists,
      })
      if (resolution.kind !== 'needs') typeOutcome = resolution
      else if (!typeWanted) return null
      else if (resolution.read === 'categories' ? view.resources.categories === 'failed' : typeLists.status === 'failed') {
        typeOutcome = { kind: 'unresolved' }
      } else {
        startTypeEvidence(resolution.read)
        return undefined
      }
    }
    return typeOutcome.kind === 'saved' ? typeOutcome.type : typeOutcome.kind === 'open' ? typeOutcome.preselect : null
  }

  /**
   * TEMP(onboarding-saved-type): the last evidence of a saved type. The assigned categories,
   * then every business type's category list (`readTypeCategories`).
   */
  const startTypeEvidence = (read: 'categories' | 'type-categories') => {
    if (store().savedType.status !== 'checking') store().setSavedType({ status: 'checking' })
    if (read === 'categories') {
      if (view.resources.categories === 'idle') track('categories', loadAccountResource(vendorId, 'categories'))
      return
    }
    if (typeLists.status !== 'idle') return
    typeLists = { status: 'loading' }
    const version = ++typeListsVersion
    loadAccountResource(vendorId, 'businessTypes').then(readTypeCategories).then(
      (lists) => {
        if (!isCurrent() || version !== typeListsVersion) return
        typeLists = { status: 'loaded', lists }
        applyReady()
        startCategoryList()
        publish()
      },
      () => {
        if (!isCurrent() || version !== typeListsVersion) return
        typeLists = { status: 'failed' }
        applyReady()
        publish()
      },
    )
  }

  /**
   * A first Step 3 save whose outcome was unknown is settled by a resolved type: confirmed if
   * the account holds the type it sent, otherwise it did not land (the fresh context says Step
   * 3 is not saved) or another save did. Left pending while the type is unresolved.
   *
   * A type only the category lists could tell is recorded too, so later entries settle from
   * the record instead of reading every list again. A named type is not: it costs one cached
   * read to tell again, and the account's own answer stays the one in use.
   */
  const settleTypeSave = (outcome: NonNullable<typeof typeOutcome>) => {
    if (outcome.kind === 'saved' && outcome.source === 'categories') return recordConfirmedType(vendorId, outcome.type)
    const pending = readSavedTypeRecord(vendorId).inFlight
    if (!pending || outcome.kind === 'unresolved') return
    if (outcome.kind === 'saved' && outcome.type.id === pending.id) recordConfirmedType(vendorId, outcome.type)
    else clearTypeSaveInFlight(vendorId)
  }

  const recheckSavedType = () => {
    if (!isCurrent() || !context) return
    typeRechecks += 1
    typeOutcome = null
    typeApplied = false
    typeWanted = true
    typeFresh = null
    typeRecheck = 'loading'
    if (typeLists.status === 'failed') typeLists = { status: 'idle' }
    if (view.resources.categories === 'failed') track('categories', loadAccountResource(vendorId, 'categories'))
    store().setSavedType({ status: 'checking' })
    // The vendor record can be stale and the context predates the save, so both are read again.
    invalidateVendorContext(vendorId)
    invalidateOnboardingResources(vendorId, ['profile'])
    const version = ++recheckVersion
    Promise.all([
      loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id)),
      loadAccountResource(vendorId, 'profile'),
    ]).then(
      ([freshContext, profile]) => {
        if (!isCurrent() || version !== recheckVersion) return
        typeFresh = { context: freshContext, profile }
        typeRecheck = 'idle'
        applyReady()
        startCategoryList()
        publish()
      },
      () => {
        if (!isCurrent() || version !== recheckVersion) return
        typeRecheck = 'failed'
        applyReady()
        publish()
      },
    )
    publish()
  }

  /**
   * Step 5's default (first) panel's first product page, read alongside the step's account
   * reads into the cache the panel paints from, so the step opens with saved and listed
   * products at once and the panel makes no request of its own. It starts once the
   * categories are applied, since they name the panel. A failure does not block the step:
   * it caches nothing, and the panel reads and retries the page itself.
   */
  const startProductPanel = () => {
    const { catalogSource: mode, categories } = store().draft
    if (!productPanelWanted || mode !== 'account' || !applied.has('categories')) return
    const first = categories[0]
    if (!first) {
      productPanelKey = null
      view.productPanel = 'loaded'
      return
    }
    const key = productReferenceCacheKey(mode, first.id)
    // Running already, or failed this visit: the panel's own read takes a failure over.
    if (key === productPanelKey && (view.productPanel === 'loading' || view.productPanel === 'failed')) return
    productPanelKey = key
    if (readReferenceCache(key)) {
      view.productPanel = 'loaded'
      return
    }
    view.productPanel = 'loading'
    readProductReferenceFirstPage(mode, first.id).then(
      () => {
        if (!isCurrent() || productPanelKey !== key) return
        view.productPanel = 'loaded'
        publish()
      },
      () => {
        if (!isCurrent() || productPanelKey !== key) return
        view.productPanel = 'failed'
        publish()
      },
    )
  }

  /**
   * Step 4's first category page, read alongside the step's account reads into the cache the
   * step paints from, so it opens with saved and listed categories at once and makes no
   * request of its own. It starts once the saved business type is known, since it names the
   * list. A failure does not block the step: it caches nothing, and the step reads, and
   * retries, the page itself.
   */
  const startCategoryList = () => {
    const { catalogSource: mode, business } = store().draft
    if (!categoryListWanted || mode !== 'account' || !typeOutcome) return
    // An unknown saved type names no list: the step offers a fresh check instead.
    const businessTypeId = typeOutcome.kind === 'unresolved' ? null : business.businessType?.id ?? null
    if (businessTypeId === null) {
      // The step asks for a business type first and reads nothing.
      categoryListKey = null
      view.categoryList = 'loaded'
      return
    }
    const key = categoryReferenceCacheKey(mode, businessTypeId)
    // Running already, or failed this visit: the step's own read takes a failure over.
    if (key === categoryListKey && (view.categoryList === 'loading' || view.categoryList === 'failed')) return
    categoryListKey = key
    if (readReferenceCache(key)) {
      view.categoryList = 'loaded'
      return
    }
    view.categoryList = 'loading'
    readCategoryReferenceFirstPage(mode, businessTypeId).then(
      (page) => {
        if (!isCurrent() || categoryListKey !== key) return
        view.categoryList = 'loaded'
        if (page.lastPage) {
          shownTypeList = {
            typeId: businessTypeId,
            categoryIds: page.items.filter((item) => item.businessTypeId === businessTypeId).map((item) => item.id),
          }
        }
        checkCatalogMixed()
        publish()
      },
      () => {
        if (!isCurrent() || categoryListKey !== key) return
        view.categoryList = 'failed'
        publish()
      },
    )
  }

  const track = (resource: OnboardingResource | 'units', read: Promise<unknown>) => {
    const version = (versions[resource] ?? 0) + 1
    versions[resource] = version
    const startedAt = pageAwayEpoch()
    if (resource === 'units') view.units = 'loading'
    else view.resources[resource] = 'loading'
    read.then(
      (value) => {
        if (!isCurrent() || versions[resource] !== version) return
        if (resource === 'units') settleUnits(value as MeasurementCatalog)
        else landValue(resource, value as OnboardingResourceData[typeof resource], startedAt)
        applyReady()
        startCategoryList()
        startProductPanel()
        publish()
      },
      () => {
        if (!isCurrent() || versions[resource] !== version) return
        if (resource === 'units') settleUnits(null)
        else view.resources[resource] = 'failed'
        applyReady()
        publish()
      },
    )
  }

  const startProfile = () => {
    if (view.resources.profile !== 'idle') return
    const cached = peekOnboardingResource(vendorId, 'profile')
    if (cached) landValue('profile', cached.value)
    else track('profile', loadAccountResource(vendorId, 'profile'))
  }

  const requestStep = (step: OnboardingStep) => {
    if (cancelled || !context || store().draft.catalogSource !== 'account') return
    const submitted = selectStoreIsSubmitted(store())
    const approved = selectStoreIsApproved(store())
    const needs = stepResources(step, { submitted, approved })
    if (stepNeedsSavedType(step, submitted)) typeWanted = true
    // Already-read values apply now, so a step whose data is cached never shows a skeleton.
    for (const resource of needs.account) {
      if (view.resources[resource] !== 'idle') continue
      if (resource === 'businessTypes' && view.resources.profile === 'loaded') {
        // Step 3 lists every type, so its read also files the step's first page. Elsewhere
        // the profile decides whether business types are needed at all.
        if (step !== 3 && !savedBusinessType(values.profile!)) {
          landValue('businessTypes', [])
          continue
        }
        const cached = peekOnboardingResource(vendorId, 'businessTypes')
        if (cached) landValue('businessTypes', cached.value)
        else track('businessTypes', loadAccountResource(vendorId, 'businessTypes'))
        continue
      }
      const cached = peekOnboardingResource(vendorId, resource)
      if (cached) landValue(resource, cached.value)
    }
    if (needs.units && view.units === 'idle') {
      const known = peekMeasurementCatalog()
      if (known) settleUnits(known)
    }
    const skip: (OnboardingResource | 'units')[] = ACCOUNT_RESOURCES.filter((resource) => view.resources[resource] !== 'idle')
    // Units are not retried within a visit: their failure has a usable fallback.
    if (view.units !== 'idle') skip.push('units')
    // A failed profile stays failed until Try again, so business types do not re-read it.
    if (view.resources.profile === 'failed') skip.push('businessTypes')
    const reads = loadStepResources(vendorId, step, { submitted, approved, withUnits: true, skip, context })
    for (const resource of Object.keys(reads) as (OnboardingResource | 'units')[]) {
      track(resource, reads[resource]!)
    }
    applyReady()
    categoryListWanted = step === 4
    productPanelWanted = step === 5
    startCategoryList()
    startProductPanel()
    publish()
  }

  const prefetchStep = (step: OnboardingStep) => {
    if (cancelled || !context || store().draft.catalogSource !== 'account') return
    const state = store()
    const submitted = selectStoreIsSubmitted(state)
    const approved = selectStoreIsApproved(state)
    const edited = new Set(state.editedSteps)
    // Anything this visit holds or is reading is left out, and so is a read that failed: it
    // stays failed until the open step's Try again reads it. An unsubmitted store keeps an
    // edited step's own copy, so a resource only edited steps use is not wanted yet.
    const skip: (OnboardingResource | 'units')[] = ACCOUNT_RESOURCES.filter((resource) =>
      view.resources[resource] !== 'idle'
      || (resource !== 'logo' && resource !== 'banner' && !submitted && RESOURCE_STEPS[resource].every((owner) => edited.has(owner))))
    if (view.resources.profile === 'failed') skip.push('businessTypes')
    // Not tracked: the step's own request joins these reads, or finds them cached, when it opens.
    loadStepResources(vendorId, step, { submitted, approved, withUnits: false, skip, context })
  }

  /** What the context alone sets: the plan limits and usage, the catalog summary and submission. */
  const applyAccountState = (loaded: VendorContext) => {
    context = loaded
    const state = store()
    hooks.setContextError(null)
    state.setCategoryLimit(loaded.subscription.limits.maxCategories)
    state.setProductLimit(loaded.subscription.limits.maxProducts)
    state.setSkuLimit(loaded.subscription.limits.maxSkus)
    state.setAccountCatalog({ skuUsage: loaded.subscription.usage.skus })
    state.setCatalogPreview(loaded.catalogPreview ?? null)
    const submitted = isStoreSubmitted({ context: loaded })
    // A submitted store still has to show its own catalog and settings on Steps 3-9,
    // so it is hydrated like any other — it just opens on the review step instead.
    state.setStoreSubmission(submitted
      ? {
          storeIdentifier: loaded.storeIdentifier,
          approvalStatus: loaded.approvalStatus,
          vendorStatus: loaded.vendorStatus,
        }
      : null)
  }

  const applyContext = (loaded: VendorContext, at = pageAwayEpoch()) => {
    applyAccountState(loaded)
    contextReadAt = at
    const submitted = isStoreSubmitted({ context: loaded })
    resumeAt = submitted ? 10 : backendResumeStep(loaded)
    // The account owns progress: every entry opens its step, unsaved local work or not.
    // Without a usable pointer, Step 10 reads everything and the step is derived from it.
    derivePending = resumeAt === null
    applyFrame(resumeAt ?? 10)
    view.context = 'loaded'
    applyReady()
    publish()
  }

  const readContext = () => {
    // Sign-in or the header may have read it already: applying it now keeps the very
    // first paint correct, instead of one frame of the un-hydrated draft. Not one read
    // before the page was last away: the account may have changed since.
    if (!vendorContextIsCurrent(vendorId)) invalidateVendorContext(vendorId)
    const known = peekVendorContext(vendorId)
    if (known) return applyContext(known)
    view.context = 'loading'
    publish()
    const startedAt = pageAwayEpoch()
    loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id)).then(
      (loaded) => {
        if (isCurrent()) applyContext(loaded, startedAt)
      },
      (error: unknown) => {
        if (!isCurrent()) return
        // Every step's reads depend on the context, so no step is usable without it.
        hooks.setContextError(getErrorMessage(error, 'Could not load your store details.'))
        view.context = 'failed'
        publish()
      },
    )
  }

  /** What a write from the step is built from and this visit read before the latest away. */
  const staleReads = (step: OnboardingStep, now: number) => {
    const state = store()
    return revalidationReads(step, {
      submitted: selectStoreIsSubmitted(state),
      approved: selectStoreIsApproved(state),
      typeSaved: typeOutcome?.kind === 'saved',
      pending: pendingSteps(state),
    }).filter((resource) => view.resources[resource] === 'loaded' && readAt[resource] !== now)
  }

  const isStale = (step: OnboardingStep) => {
    if (!isCurrent() || !context) return false
    const now = pageAwayEpoch()
    return contextReadAt !== now || staleReads(step, now).length > 0
  }

  const revalidate = async (step: OnboardingStep): Promise<RevalidationOutcome> => {
    if (!isCurrent() || !context) return { kind: 'ended' }
    const now = pageAwayEpoch()
    const reads = staleReads(step, now)
    const readsContext = contextReadAt !== now
    if (!readsContext && !reads.length) return { kind: 'current' }
    // A read started since the away, here or elsewhere (a header, a failed attempt's reads that
    // succeeded), is joined. The resource cache already replaces older entries itself.
    if (readsContext && !vendorContextIsCurrent(vendorId)) invalidateVendorContext(vendorId)
    let fresh: VendorContext
    let results: unknown[]
    try {
      [fresh, ...results] = await Promise.all([
        readsContext ? loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id)) : context,
        ...reads.map((resource) => loadAccountResource(vendorId, resource)),
      ])
    } catch (error) {
      return isCurrent() ? { kind: 'failed', error } : { kind: 'ended' }
    }
    if (!isCurrent() || !context) return { kind: 'ended' }
    if (accountStatusChanged(store(), fresh)) {
      hooks.restart()
      return { kind: 'blocked' }
    }
    if (readsContext) {
      applyAccountState(fresh)
      contextReadAt = now
      // Step 9's store name comes from the context.
      if (applied.has('profile')) applied.delete('profile')
    }
    reads.forEach((resource, index) => {
      // A read of the same resource still on its way lands nothing.
      versions[resource] = (versions[resource] ?? 0) + 1
      applied.delete(resource)
      view.resources[resource] = 'idle'
      landValue(resource, results[index] as OnboardingResourceData[typeof resource], now)
    })
    if (reads.includes('profile') && typeOutcome?.kind !== 'saved') {
      // A type saved elsewhere meanwhile is worked out again, as a recheck does.
      typeFresh = { context: fresh, profile: values.profile! }
      typeOutcome = null
      typeApplied = false
      typeWanted = true
    }
    // Step 9's saved values are worked out again from what was re-applied.
    if (readsContext || reads.includes('profile') || reads.includes('storefront')) storeDetailsBaselined = false
    // A fingerprint of what this visit last sent no longer proves the account holds it.
    hooks.savedSteps.current = {}
    priorBaselines = store().savedBaselines
    try {
      applyReady()
    } finally {
      priorBaselines = null
      accountWhatsapp = null
    }
    publish()
    return store().savedType.status === 'checking' ? { kind: 'blocked' } : { kind: 'current' }
  }

  startProfile()
  readContext()

  return {
    isStale,
    revalidate,
    requestStep,
    prefetchStep,
    retryImage(kind) {
      if (!isCurrent() || view.resources[kind] !== 'failed') return
      applied.delete(kind)
      track(kind, loadAccountResource(vendorId, kind))
      publish()
    },
    recordImage(kind, url) {
      if (!isCurrent()) return
      versions[kind] = (versions[kind] ?? 0) + 1
      values[kind] = url
      view.resources[kind] = 'loaded'
      applied.add(kind)
      publish()
    },
    retry(step) {
      const needs = stepResources(step, { submitted: selectStoreIsSubmitted(store()), approved: selectStoreIsApproved(store()) })
      for (const resource of needs.account) {
        if (view.resources[resource] === 'failed') view.resources[resource] = 'idle'
      }
      if (view.context === 'failed') {
        if (view.resources.profile === 'failed') view.resources.profile = 'idle'
        startProfile()
        // The step's reads start once the context lands.
        readContext()
      } else requestStep(step)
      if (typeOutcome?.kind === 'unresolved') recheckSavedType()
      publish()
    },
    confirmSavedType(type) {
      if (!isCurrent()) return
      // Whatever an earlier read or recheck says, the save is what the account holds now.
      recheckVersion += 1
      typeRecheck = 'idle'
      typeOutcome = { kind: 'saved', type, source: 'record' }
      typeApplied = true
      publish()
    },
    recheckSavedType,
    cancel() {
      cancelled = true
    },
  }
}

/**
 * A step the account already counts as done, with nothing different from its known saved
 * values (and no image waiting to upload), has nothing to write.
 */
function savedAndUnchanged(state: OnboardingState, step: OnboardingStep): boolean {
  const hasPendingImages = step === 9 && Boolean(state.runtime.logoFile || state.runtime.bannerFile)
  return !hasPendingImages && state.draft.completedSteps.includes(step)
    && isAccountStep(step) && Boolean(state.savedBaselines[step]) && !pendingSteps(state).includes(step)
}

/**
 * The Continue validation for Steps 3-10, read entirely from the given store state so a
 * re-check while the vendor edits runs exactly what Continue ran. The projected account
 * total is what every limit gates, so validation is handed the account snapshot and the
 * product/size caps alongside the category cap.
 */
function catalogStepIssues(state: OnboardingState): ValidationIssue[] {
  const { draft, runtime, measurementCatalog, accountCatalog, productLimit, skuLimit } = state
  const categoryLimit = selectCategoryLimit(state)
  const enforcement = { maxProducts: productLimit, maxSkus: skuLimit, account: accountCatalog }
  if (draft.currentStep === 10) {
    // Submission waits for every unsaved step to be saved or undone, as well as for readiness.
    // An unconfirmed saved type replaces Step 3's own check: there is nothing to choose.
    const { savedType } = state
    const typeIssues: ValidationIssue[] = savedType.status === 'unresolved'
      ? [{ step: 3, field: 'business-type', message: unresolvedTypeMessage(savedType.retried) }]
      : []
    return [
      ...pendingEditIssues(pendingSteps(state)),
      ...typeIssues,
      // A mixed saved catalog waits for support, as Steps 4-6 do.
      ...mixedCatalogIssues(state.catalogMixed && !selectStoreIsSubmitted(state)),
      ...readinessIssues(draft, runtime, categoryLimit, measurementCatalog, enforcement)
        .filter((issue) => !typeIssues.length || issue.step !== 3),
    ]
  }
  // Validate additions without reopening whole-store readiness for submitted vendors.
  return selectStoreIsSubmitted(state) && draft.currentStep !== 9
    ? additiveCatalogIssues(draft.currentStep, draft, categoryLimit, enforcement, measurementCatalog)
    : validateStep(draft.currentStep, draft, runtime, categoryLimit, measurementCatalog, enforcement)
}

const phoneIssues: IssueRecheck = (state) => validateStep(1, state.draft, state.runtime)

const OTP_INCOMPLETE: ValidationIssue = { step: 2, field: 'otp-0', message: 'Enter the 4-digit OTP.' }
const otpIssues: IssueRecheck = (state) => state.runtime.otpDigits.some((digit) => !digit) ? [OTP_INCOMPLETE] : []

/**
 * A submitted store is read-only except for categories/products, an approved store's sizes and branding,
 * and the Step 10 status view. The Continue handler and the
 * `fieldset` guard both read this one predicate so they cannot drift out of lockstep.
 */
function submittedStepIsReadOnly(step: OnboardingStep, submitted: boolean, approved: boolean): boolean {
  return submitted && step < 10 && !(approved && step === 9) && !isAdditiveCatalogStep(step, approved)
}

/**
 * Approved-store size and branding edits save without reopening the review flow.
 */
function savesInPlace(step: OnboardingStep, submitted: boolean, approved: boolean): boolean {
  return submitted && approved && (step === 6 || step === 9)
}

export function OnboardingWizard() {
  return <OnboardingFeedbackProvider><OnboardingWizardContent /></OnboardingFeedbackProvider>
}

function OnboardingWizardContent() {
  const feedback = useOnboardingFeedback()
  const currentStep = useOnboardingStore((state) => state.draft.currentStep)
  const completedSteps = useOnboardingStore((state) => state.draft.completedSteps)
  const furthestVisitedStep = useOnboardingStore((state) => state.furthestVisitedStep)
  const catalogSource = useOnboardingStore(selectCatalogSource)
  const publicationState = useOnboardingStore((state) => state.draft.publication.state)
  const persistenceInitialized = useOnboardingStore((state) => state.persistenceInitialized)
  const persistenceStatus = useOnboardingStore((state) => state.persistenceStatus)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const completeStep = useOnboardingStore((state) => state.completeStep)
  const goToStep = useOnboardingStore((state) => state.goToStep)
  const completePrototype = useOnboardingStore((state) => state.completePrototype)
  const flushPersistence = useOnboardingStore((state) => state.flushPersistence)
  const setCategoryLimit = useOnboardingStore((state) => state.setCategoryLimit)
  const setProductLimit = useOnboardingStore((state) => state.setProductLimit)
  const setSkuLimit = useOnboardingStore((state) => state.setSkuLimit)
  const setStoreSubmission = useOnboardingStore((state) => state.setStoreSubmission)
  const setAccountCatalog = useOnboardingStore((state) => state.setAccountCatalog)
  const setCatalogPreview = useOnboardingStore((state) => state.setCatalogPreview)
  const setProductMeasurementCatalog = useOnboardingStore((state) => state.setProductMeasurementCatalog)
  const recordAssignment = useOnboardingStore((state) => state.recordAssignment)
  const recordCreatedEntry = useOnboardingStore((state) => state.recordCreatedEntry)
  const setLoadedSteps = useOnboardingStore((state) => state.setLoadedSteps)
  const resetSavedBaselines = useOnboardingStore((state) => state.resetSavedBaselines)
  const recordSavedBaselines = useOnboardingStore((state) => state.recordSavedBaselines)
  const returnStep = useOnboardingStore((state) => state.returnStep)
  // Done catalog steps an edit left with missing work, as a string so the wizard re-renders
  // only when that set changes, not on every keystroke.
  const attentionKey = useOnboardingStore((state) => stepsNeedingAttention(
    catalogDependencyGaps(state.draft),
    state.draft.completedSteps,
    selectStoreIsSubmitted(state),
  ).join(','))
  const attentionSteps = useMemo(
    () => attentionKey ? attentionKey.split(',').map(Number) as OnboardingStep[] : [],
    [attentionKey],
  )
  const savedType = useOnboardingStore((state) => state.savedType)
  const setSavedType = useOnboardingStore((state) => state.setSavedType)
  const catalogMixed = useOnboardingStore((state) => state.catalogMixed)
  const setCatalogMixed = useOnboardingStore((state) => state.setCatalogMixed)
  // Read from the account, not the draft: a browser can claim setup needs no more work when
  // nothing ever reached an account. Once true, setup shows what was sent and stops
  // offering controls that cannot reach a store already under review.
  const storeIsSubmitted = useOnboardingStore(selectStoreIsSubmitted)
  const storeIsApproved = useOnboardingStore(selectStoreIsApproved)
  // Every draft edit marks its step edited and a synced save clears it, so this is what
  // retires a "Changes saved." confirmation once the vendor edits again.
  const currentStepEdited = useOnboardingStore((state) => state.editedSteps.includes(state.draft.currentStep))
  const categoryLimit = useOnboardingStore(selectCategoryLimit)
  const adoptVerifiedSession = useOnboardingStore((state) => state.adoptVerifiedSession)
  const revokeVerifiedSession = useOnboardingStore((state) => state.revokeVerifiedSession)

  const completeOtpLogin = useAuthStore((state) => state.completeOtpLogin)
  const selectVendor = useAuthStore((state) => state.selectVendor)
  const logout = useAuthStore((state) => state.logout)
  const { access } = useOnboardingDraftSession()
  const catalogUnlocked = canEnterCatalogSteps(access)
  const liveApi = isLiveApi()
  // One answer for every catalog control below: switch permission, control visibility, and
  // the Continue block. Recomputes from the subscribed `catalogSource`/`completedSteps`, so
  // the handlers and the render agree without re-reading the store in each one.
  const catalogPolicy = selectCatalogPolicy({ draft: { catalogSource, completedSteps } }, { liveApi })

  const [shownIssues, setShownIssues] = useState<ShownIssues>(NO_ISSUES)
  // While the vendor edits, a validation issue the same check no longer reports is hidden;
  // new problems still wait for the next Continue. The selector returns the indexes still
  // present as a string, so the wizard re-renders only when that set changes — not per
  // keystroke — and `issues` keeps its identity while the set holds. Hiding a fixed issue
  // never adds one, so Step 6 (which opens a panel only for a newly arrived issue) stays put.
  const stillShownKey = useOnboardingStore((state) => {
    const { issues: shown, recheck } = shownIssues
    if (!recheck) return 'all'
    const current = recheck(state)
    return shown
      .flatMap((item, index) =>
        current.some((next) => next.field === item.field && next.message === item.message) ? [index] : [])
      .join(',')
  })
  const issues = useMemo(() => {
    if (stillShownKey === 'all') return shownIssues.issues
    const kept = new Set(stillShownKey.split(','))
    return shownIssues.issues.filter((_, index) => kept.has(String(index)))
  }, [shownIssues, stillShownKey])
  // What the step components render inline; a toast-only issue still counts as shown above.
  const inlineIssues = shownIssues.toastOnly ? NO_INLINE_ISSUES : issues
  useEffect(() => {
    if (shownIssues.issues.length && !issues.length) feedback.clear()
  }, [shownIssues, issues.length, feedback])
  useEffect(() => {
    if (currentStepEdited) feedback.clear()
  }, [currentStepEdited, feedback])
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  // Where this visit's account reads stand. The wizard must not paint an interactive step
  // before the context has been read (Step 3 would flash and then jump to wherever the
  // resume lands), and a step's form waits for the resources that step needs.
  const [loadView, setLoadView] = useState<AccountLoadView>(IDLE_LOAD_VIEW)
  const entryRef = useRef<AccountEntry | null>(null)
  // Bumped to start the visit again, as on entry, when a revalidation finds the store
  // submitted or its approval changed elsewhere.
  const [entryRun, setEntryRun] = useState(0)
  // Steps 4-9 whose draft is known to match the account, as `stepSaveFingerprint` values.
  // A Continue on a matching step skips the save and the reads it makes. Anything not
  // vouched for by a save (or, for catalog steps, a resume) in this visit is absent, so it
  // saves as before.
  const savedStepRef = useRef<Partial<Record<OnboardingStep, string>>>({})
  const [contextError, setContextError] = useState<string | null>(null)
  // A session is what Steps 1-2 exist to produce, so having one closes them. The floor
  // is owned by the access module rather than computed here, because it is a statement
  // about the session and nothing else — it used to also require a submitted store,
  // which let every vendor mid-setup walk back into the identity steps.
  const firstNavigableStep = navigationFloor(access)
  const identitySettled = firstNavigableStep > 1
  // Steps 1-2 are the /vendor/login job, so they take its centred single column.
  const identityStep = currentStep <= 2 && !identitySettled
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form')
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(EMPTY_CONFIRM)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formScrollRef = useRef<HTMLDivElement>(null)
  const requestControllerRef = useRef<AbortController | null>(null)

  const cancelActiveRequest = () => {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setBusy(false)
  }

  useEffect(() => {
    const handlePageHide = () => flushPersistence()
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushPersistence()
    }
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      requestControllerRef.current?.abort()
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibility)
      // Leaving the wizard must not leave a queued write behind: it would land after
      // any sign-out cleanup and restore the draft that was just cleared.
      flushPersistence()
    }
  }, [flushPersistence])

  // Steps 1-2 exist to establish a session. If one already exists (for example the vendor
  // signed in at /vendor/login first) they are already satisfied; if it disappears, the
  // draft must not keep claiming a verified number.
  useEffect(() => {
    if (!persistenceInitialized) return
    if (access.state === 'anonymous') revokeVerifiedSession()
    else adoptVerifiedSession(null)
    // Keyed on `access`, not `access.state`: the active vendor can change while the
    // state stays 'ready', and that resets the draft to Step 1 with the identity steps
    // locked — leaving no reachable step unless this runs again.
  }, [access, persistenceInitialized, adoptVerifiedSession, revokeVerifiedSession])

  /**
   * Bring the wizard in line with the vendor's account.
   *
   * The account is the record and this browser only buffers what has not reached it, so
   * this runs on every entry — not once per browser. It reads the context and the profile
   * now and each step's other resources when that step opens (below). An unsaved edit stays
   * while the account still holds the value it started from.
   */
  useLayoutEffect(() => {
    savedStepRef.current = {}
    // Which steps hold account data, and their saved values, are known only for this visit;
    // the entry sets them again as each read lands.
    setLoadedSteps([])
    resetSavedBaselines()
    setSavedType({ status: 'unknown' })
    setCatalogMixed(false)
    setLoadView(IDLE_LOAD_VIEW)
    setContextError(null)
    if (access.state !== 'ready') {
      setCategoryLimit(null)
      setProductLimit(null)
      setSkuLimit(null)
      setStoreSubmission(null)
      setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [], skuUsage: null })
      setCatalogPreview(null)
      if (isLiveApi()) setProductMeasurementCatalog([])
      return
    }
    // Demo mode has no account to read; the local draft is all there is, so every step
    // counts as loaded.
    if (!isLiveApi()) {
      setLoadedSteps([...ACCOUNT_STEPS])
      // The demo's own simulated Step 3 save is its only saved type.
      const confirmed = readSavedTypeRecord(access.vendorId).confirmed
      setSavedType(confirmed ? { status: 'saved', type: confirmed } : { status: 'open' })
      return
    }

    // The store starts with the demo catalog. Clear it before a live account can paint,
    // including ready-session mounts, vendor changes, and account reads that later fail.
    setProductMeasurementCatalog([])
    setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [], skuUsage: null })
    setCatalogPreview(null)
    const entry = startAccountEntry(access.vendorId, {
      setView: setLoadView,
      setContextError,
      savedSteps: savedStepRef,
      restart: () => setEntryRun((run) => run + 1),
    })
    entryRef.current = entry
    return () => {
      entry.cancel()
      if (entryRef.current === entry) entryRef.current = null
    }
  }, [access, entryRun, setCategoryLimit, setProductLimit, setSkuLimit, setStoreSubmission, setAccountCatalog, setCatalogPreview, setProductMeasurementCatalog, setLoadedSteps, resetSavedBaselines, setSavedType, setCatalogMixed])

  // Each step reads what it needs when it opens; a read already made this visit is reused.
  // A layout effect, so a step whose data is cached paints its form without a skeleton frame.
  useLayoutEffect(() => {
    if (loadView.context === 'loaded') entryRef.current?.requestStep(currentStep)
  }, [currentStep, loadView.context, catalogSource, storeIsSubmitted])

  useEffect(() => {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setBusy(false)
    setShownIssues(NO_ISSUES)
    setStatusMessage(null)
    feedback.clear()
    setMobileView('form')
    formScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    window.setTimeout(() => headingRef.current?.focus(), 0)
  }, [currentStep, feedback])

  const requestConfirmation: RequestConfirmation = (request) => {
    setConfirmState({ ...request, open: true })
  }

  const focusField = (field: string) => {
    window.setTimeout(() => {
      const target = document.getElementById(field)
      // A disclosure is focused by its summary. The field's message is what gets centred: a
      // group such as an open panel or a list of panels is taller than the screen, so centring
      // the field itself pushes its message out of view.
      const element = target instanceof HTMLDetailsElement ? target.querySelector(':scope > summary')
        : target instanceof HTMLInputElement && target.type === 'file' ? document.getElementById(`${field}-button`) : target
      if (element instanceof HTMLElement) {
        const scrollTarget = document.getElementById(`${field}-error`) ?? element
        const reveal = () => {
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          scrollTarget.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
        }
        const disclosure = element.closest('details')
        if (disclosure instanceof HTMLDetailsElement && !disclosure.open) {
          // Opening a group closes the one that was open, often above it, once its toggle
          // re-renders. Scrolling before that collapse lands past the target on short screens.
          disclosure.addEventListener('toggle', () => window.setTimeout(reveal, 0), { once: true })
          disclosure.open = true
        } else window.setTimeout(reveal, 0)
        if (!element.hasAttribute('tabindex') && !element.matches('input,button,select,textarea,a,summary')) {
          element.setAttribute('tabindex', '-1')
        }
        element.focus({ preventScroll: true })
      } else headingRef.current?.focus()
    }, 0)
  }

  /**
   * Shows issues and focuses the first. Pass `recheck` only for validation-origin issues:
   * those clear as the vendor fixes them. Server and request failures (OTP, a failed save
   * or go-live, the blocked sample catalog) omit it and stay until the next action.
   */
  const showIssues = (nextIssues: ValidationIssue[], recheck?: IssueRecheck) => {
    const current = useOnboardingStore.getState().draft.currentStep
    // Only a validation re-run (`recheck`) marks a missing choice; a failed save on the same
    // step keeps its inline message, which outlives the toast.
    const toastOnly = Boolean(recheck) && current >= 3 && current <= 5 && nextIssues.every(isMissingChoice)
    setShownIssues({ issues: nextIssues, recheck, toastOnly })
    const first = nextIssues[0]
    if (first && !INLINE_ONLY_STEPS.includes(current)) feedback.show(first.message, 'error')
    // Every other issue renders inline on its own step. Step 10's readiness check raises issues
    // for Steps 3-9, whose fields are not on screen; Step 10 lists those in its readiness list.
    // A toast-only issue has nothing to scroll to, except a category's panel, which still opens.
    if (first && (!toastOnly || first.field.startsWith('category-products-'))) {
      focusField(first.step === current ? first.field : 'readiness-issues')
    }
  }

  const requestSampleCatalog = () => {
    if (!catalogPolicy.canSwitchTo('sample')) return
    requestConfirmation({
      title: 'Switch the whole catalog to sample data?',
      description: 'This clears the current business type, categories, products, and their sizes and prices, because sample and live IDs cannot be mixed.',
      confirmLabel: 'Use sample catalog',
      tone: 'danger',
      onConfirm: () => {
        cancelActiveRequest()
        updateDraft((current) => ({
          ...current,
          catalogSource: 'sample',
          business: { ...current.business, businessType: null },
          categories: [],
          products: [],
          skus: [],
        }), 3)
      },
    })
  }

  const requestLiveCatalog = () => {
    if (!catalogPolicy.canSwitchTo('account')) return
    requestConfirmation({
      title: 'Return to the live catalog?',
      description: 'Sample selections will be cleared before live data loads because their IDs are not compatible.',
      confirmLabel: 'Return to live catalog',
      tone: 'danger',
      onConfirm: () => {
        cancelActiveRequest()
        updateDraft((current) => ({
          ...current,
          catalogSource: 'account',
          business: { ...current.business, businessType: null },
          categories: [],
          products: [],
          skus: [],
        }), 3)
      },
    })
  }

  const beginRequest = () => {
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setBusy(true)
    return controller
  }

  const requestIsCurrent = (controller: AbortController, expectedStep: OnboardingStep) =>
    !controller.signal.aborted &&
    requestControllerRef.current === controller &&
    useOnboardingStore.getState().draft.currentStep === expectedStep

  const finishRequest = (controller: AbortController) => {
    if (requestControllerRef.current !== controller) return
    requestControllerRef.current = null
    setBusy(false)
  }

  const handleOtpRequest = async () => {
    // Only reachable without a session: the floor closes Steps 1-2 the moment one
    // exists, so `request-otp` can no longer swap the signed-in vendor underneath a
    // draft. Changing number now goes through sign-out instead.
    if (identitySettled) return
    const state = useOnboardingStore.getState()
    const nextIssues = phoneIssues(state)
    if (nextIssues.length) {
      showIssues(nextIssues, phoneIssues)
      return
    }
    await sendOtp(state.runtime.phone)
  }

  const sendOtp = async (phone: string) => {
    const controller = beginRequest()
    setStatusMessage('Sending OTP…')
    try {
      // Both 200 (existing account) and 201 (new account) are request successes, and
      // neither means the number is verified yet.
      await authService.requestOtp({ phone, role: 'vendor' })
      if (!requestIsCurrent(controller, 1)) return
      setStatusMessage(null)
      updateDraft((current) => ({ ...current, maskedPhone: maskPhone(phone), mobileVerified: false }), 1)
      completeStep(1, 2)
    } catch (error) {
      if (!requestIsCurrent(controller, 1)) return
      setStatusMessage(null)
      showIssues([
        { step: 1, field: 'phone', message: getErrorMessage(error, 'Could not send OTP. Try again.') },
      ])
    } finally {
      finishRequest(controller)
    }
  }

  const handleOtpVerify = async () => {
    if (identitySettled) return
    const state = useOnboardingStore.getState()
    const { runtime } = state
    const otp = runtime.otpDigits.join('')
    const nextIssues = otpIssues(state)
    if (nextIssues.length) {
      showIssues(nextIssues, otpIssues)
      return
    }
    const controller = beginRequest()
    setStatusMessage('Verifying…')
    try {
      // Establishes the real session. AuthSessionError covers an unverified number or a
      // number without vendor authority; both surface as an actionable message here.
      const session = await authService.verifyOtp({ phone: runtime.phone, otp, role: 'vendor' })
      if (!requestIsCurrent(controller, 2)) return
      completeOtpLogin(session)
      setStatusMessage(null)
      updateDraft((current) => ({ ...current, mobileVerified: true }), 2)
      completeStep(2, 3)
    } catch (error) {
      if (!requestIsCurrent(controller, 2)) return
      setStatusMessage(null)
      showIssues([
        { step: 2, field: 'otp-0', message: getErrorMessage(error, 'Invalid or expired OTP. Try again.') },
      ])
    } finally {
      finishRequest(controller)
    }
  }

  const resendOtp = async () => {
    if (identitySettled) return false
    const { runtime } = useOnboardingStore.getState()
    if (!runtime.phone) {
      setStatusMessage(null)
      showIssues([{ step: 2, field: 'otp-0', message: 'Return to the first step and enter the phone number again.' }])
      return false
    }
    const controller = beginRequest()
    setStatusMessage('Sending a new OTP…')
    try {
      await authService.requestOtp({ phone: runtime.phone, role: 'vendor' })
      if (requestIsCurrent(controller, 2)) {
        setStatusMessage(null)
        feedback.show('New OTP sent to WhatsApp.', 'success')
        return true
      }
    } catch (error) {
      if (requestIsCurrent(controller, 2)) {
        setStatusMessage(null)
        showIssues([
          { step: 2, field: 'otp-0', message: getErrorMessage(error, 'Could not resend OTP. Try again.') },
        ])
      }
    } finally {
      finishRequest(controller)
    }
    return false
  }

  /**
   * Whether a press of the step's primary action must first read the account again: it writes,
   * and the page has been away since this visit read what the write is built from. Demo mode,
   * sample drafts, read-only steps and saves with nothing to write never do.
   */
  const needsRevalidation = () => {
    const state = useOnboardingStore.getState()
    const step = state.draft.currentStep
    const entry = entryRef.current
    if (!entry || access.state !== 'ready' || !writesReachAccount(state.draft.catalogSource)) return false
    const writes = step === 10
      ? !storeIsSubmitted
      : !submittedStepIsReadOnly(step, storeIsSubmitted, storeIsApproved) && !savedAndUnchanged(state, step)
    return writes && entry.isStale(step)
  }

  /**
   * Read again what the write is built from and merge it silently, as on entry. A failed read
   * keeps the input and stops the write with the step's own error; pressing again retries.
   * `true` when the write may go ahead on what the draft now holds.
   */
  const revalidateBeforeWrite = async (): Promise<boolean> => {
    const entry = entryRef.current
    const step = useOnboardingStore.getState().draft.currentStep
    if (!entry) return false
    const controller = beginRequest()
    if (step !== 10) setStatusMessage('Saving to your store…')
    try {
      const outcome = await entry.revalidate(step)
      if (!requestIsCurrent(controller, step)) return false
      setStatusMessage(null)
      if (outcome.kind === 'failed') {
        const fallback = step === 10 ? 'Could not submit your store. Please try again.' : 'Could not save this step. Please try again.'
        showIssues([{ step, field: stepErrorField(step), message: getErrorMessage(outcome.error, fallback) }])
      }
      return outcome.kind === 'current'
    } finally {
      finishRequest(controller)
    }
  }

  /**
   * The one-way live submission, run only after the Step 10 confirmation is accepted.
   *
   * Kept separate from the Continue handler so the confirmation's `onConfirm` performs the
   * existing submission exactly once, and cancelling never touches the account.
   */
  const submitStoreForReview = async (slug: string) => {
    // The live branch only opens the confirmation with a ready session, but re-checking
    // keeps the vendorId narrowing local to this function.
    if (access.state !== 'ready') return
    const controller = beginRequest()
    setStatusMessage('Submitting your store for review…')
    try {
      try {
        await vendorOnboardingService.goLive(access.vendorId)
      } catch (error) {
        if (!requestIsCurrent(controller, 10)) return
        setStatusMessage(null)
        showIssues([
          {
            step: 10,
            field: 'store-name',
            message: getErrorMessage(error, 'Could not submit your store. Please try again.'),
          },
        ])
        return
      }

      // The account just changed, even if local navigation stopped tracking this
      // request while it was in flight. Never let a stale cache hide the submission.
      dropWrittenAccountData(access.vendorId, GO_LIVE_RESOURCES)
      // Do not let a late response attach the previous vendor's state to a new session.
      if (useAuthStore.getState().user?.vendorId !== access.vendorId) return
      // The successful account action is enough to establish submission. Details stay
      // unknown until the read-back below, but a failed status read must not make the
      // submitted store writable again.
      setStoreSubmission({
        storeIdentifier: null,
        approvalStatus: null,
        vendorStatus: null,
      })

      // Past this point the store is submitted. The read-back only refines what is
      // shown, so its failure must never be reported as a failed submission — that
      // wording sends the vendor back to press submit again on a store that is already
      // submitted.
      if (!requestIsCurrent(controller, 10)) return
      try {
        // Submission activates the vendor but approval is a separate admin step, so the
        // real state is read back rather than assumed — through the shared context cache,
        // so the dashboard this leads to reuses it instead of reading it again.
        const context = await loadVendorContext(
          access.vendorId,
          (id) => vendorOnboardingService.getVendorContext(id),
        )
        if (!requestIsCurrent(controller, 10)) return
        setStoreSubmission({
          storeIdentifier: context.storeIdentifier,
          approvalStatus: context.approvalStatus,
          vendorStatus: context.vendorStatus,
        })
      } catch {
        if (!requestIsCurrent(controller, 10)) return
        setContextError(
          'Your store was submitted. We could not load its latest status just now — reload to see it.',
        )
      }
      setStatusMessage(null)
      completePrototype(slug)
    } finally {
      finishRequest(controller)
    }
  }

  const handleCatalogContinue = async () => {
    if (needsRevalidation() && !(await revalidateBeforeWrite())) return
    const state = useOnboardingStore.getState()
    const { draft, runtime } = state
    if (draft.currentStep === 10) {
      const nextIssues = catalogStepIssues(state)
      if (nextIssues.length) return showIssues(nextIssues, catalogStepIssues)

      const slug = normalizeDraftSlug(draft.storefront.storeName || draft.business.businessName)
      // Sample mode is gated here for the same reason Steps 3-9 gate on it: its IDs are
      // synthetic and nothing behind them was ever written. Without this, activation would
      // submit a real vendor account from a wizard the UI is presenting as sample data. Demo
      // mode lands here too: both take the private in-browser preview path, with no
      // administrator review to confirm first.
      if (!writesReachAccount(draft.catalogSource) || access.state !== 'ready') {
        completePrototype(slug)
        return
      }

      // Live: submission is a one-way request for review that locks setup, so a deliberate
      // confirmation stands between readiness passing and the account write.
      requestConfirmation({
        title: 'Submit your store for review?',
        description:
          'MithraDirect reviews your store before any decision is made. While it is under review your setup is read-only — you can still add more categories and products, but everything else stays locked until the review is done.',
        confirmLabel: 'Submit for review',
        onConfirm: () => void (async () => {
          // The page may have been away while the confirmation was open.
          if (needsRevalidation()) {
            if (!(await revalidateBeforeWrite())) return
            const issues = catalogStepIssues(useOnboardingStore.getState())
            if (issues.length) return showIssues(issues, catalogStepIssues)
          }
          await submitStoreForReview(slug)
        })(),
      })
      return
    }
    // Catalog growth still saves after submission; new sizes require real approval.
    // Locked steps are pure navigation and must not validate or write existing settings.
    if (submittedStepIsReadOnly(draft.currentStep, storeIsSubmitted, storeIsApproved)) {
      navigateToStep((draft.currentStep + 1) as OnboardingStep)
      return
    }

    const nextIssues = catalogStepIssues(state)
    if (nextIssues.length) return showIssues(nextIssues, catalogStepIssues)

    const step = draft.currentStep
    // A locked type is never sent over: Step 3 can only re-save the saved type.
    const typeChoice = step === 3 ? draft.business.businessType : null
    const lockedType = state.savedType.status === 'saved' ? state.savedType.type : null
    if (step === 3 && lockedType && typeChoice?.id !== lockedType.id) {
      feedback.show(BUSINESS_TYPE_LOCKED_MESSAGE, 'warning')
      return
    }
    const inPlace = savesInPlace(step, storeIsSubmitted, storeIsApproved)
    // A save from an earlier step returns to where the vendor came from, first stopping at
    // any catalog step it left with missing work; a first-time step moves on as usual. A
    // submitted store keeps its own rules.
    const nextStep = inPlace ? step : stepAfterCatalogSave(
      step,
      storeIsSubmitted ? null : state.returnStep,
      stepsNeedingAttention(catalogDependencyGaps(draft), draft.completedSteps, storeIsSubmitted),
    )
    // Started alongside this step's save, so the next step's account data is usually ready
    // when it opens. A failure is dropped from the cache and the step's own read retries it.
    // Units are left to the step that needs them. A save in place opens no next step.
    if (!inPlace && writesReachAccount(draft.catalogSource) && access.state === 'ready') {
      entryRef.current?.prefetchStep(nextStep)
    }
    const hasPendingImages = step === 9 && Boolean(runtime.logoFile || runtime.bannerFile)
    const nothingToWrite = savedAndUnchanged(state, step)
    const reachesAccount =
      writesReachAccount(draft.catalogSource) &&
      isLivePersistedStep(step) &&
      access.state === 'ready'

    if (reachesAccount && !nothingToWrite && access.state === 'ready') {
      const controller = beginRequest()
      const persistenceIsCurrent = () => requestIsCurrent(controller, step)
        && useAuthStore.getState().user?.vendorId === access.vendorId
        && useOnboardingStore.getState().draftOwnerId === access.vendorId
      setStatusMessage('Saving to your store…')
      // Steps 7 and 8 share one full checkout write; it carries the other step's saved
      // values, so neither step's unsaved edits reach the account through the other.
      const sharesCheckout = step === 7 || step === 8
      // A first type save is marked before it is sent, so a reload or a lost response while
      // it is pending is checked against the account before the vendor may choose again.
      const firstTypeSave = typeChoice !== null && !lockedType
      try {
        const input = sharesCheckout
          ? await checkoutSaveInput(step, access.vendorId, draft, runtime)
          : { draft, runtime }
        if (!persistenceIsCurrent()) return
        const fingerprint = stepSaveFingerprint(step, input.draft, input.runtime)
        const unchanged = !hasPendingImages && fingerprint !== null && savedStepRef.current[step] === fingerprint
        if (!unchanged) {
          if (firstTypeSave) markTypeSaveInFlight(access.vendorId, typeChoice)
          // Each write reports what it put on the account, so a step that fails part way
          // still records the part that landed. SKU creates also reread their saved IDs.
          // Submitted stores reach this for categories/products and, once approved, sizes.
          // Known size IDs let Step 6 find switched-off sizes the account's size list omits.
          await persistStep(step, access.vendorId, input.draft, input.runtime, (assignment) => {
            if (persistenceIsCurrent()) recordAssignment(assignment)
          }, recordCreatedEntry, state.accountCatalog.skuIds, {
            signal: controller.signal,
            approvedStore: storeIsSubmitted && storeIsApproved,
            isCurrent: persistenceIsCurrent,
            onUploaded: (kind, file, url) => {
              if (!persistenceIsCurrent()) return
              useOnboardingStore.getState().recordUploadedImage(kind, file, url)
              setOnboardingResource(access.vendorId, kind, url)
              entryRef.current?.recordImage(kind, url)
            },
          })
          if (typeChoice) confirmTypeSave(access.vendorId, typeChoice)
          // This step is now on the account, so a cached read from before it is stale. The
          // open wizard keeps what it holds: the draft is now the account copy.
          dropWrittenAccountData(access.vendorId, savedResources(step))
          if (!persistenceIsCurrent()) return
          // Read after the save: minting authored entries rewrites their ids in the draft.
          const latest = useOnboardingStore.getState()
          const saved = sharesCheckout ? fingerprint : stepSaveFingerprint(step, latest.draft, latest.runtime)
          if (saved) for (const sharing of stepsSavedTogether(step)) savedStepRef.current[sharing] = saved
        }
        recordSavedStep(step, input)
        setStatusMessage(null)
      } catch (error) {
        if (firstTypeSave) settleFailedTypeSave(access.vendorId, error)
        // Part of the step may have landed, so it no longer matches anything known.
        if (step === 9) dropWrittenAccountData(access.vendorId, savedResources(step))
        for (const sharing of stepsSavedTogether(step)) delete savedStepRef.current[sharing]
        if (isAccountStep(step)) recordSavedBaselines({ [step]: undefined })
        if (!persistenceIsCurrent()) return
        setStatusMessage(null)
        // A failed write is never reported as local success.
        if (error instanceof ImageSaveError) {
          showIssues(error.issues, (latest) => error.issues.filter((issue) =>
            issue.field === 'store-logo-file'
              ? latest.runtime.logoFile === runtime.logoFile
              : latest.runtime.bannerFile === runtime.bannerFile))
          return
        }
        showIssues([
          {
            step,
            field: stepErrorField(step),
            message: getErrorMessage(error, 'Could not save this step. Please try again.'),
          },
        ])
        return
      } finally {
        finishRequest(controller)
      }
    } else if (!reachesAccount) {
      // Demo mode simulates the save, so the step's input counts as saved here too, and a
      // simulated type save locks the type as a real one does.
      recordSavedStep(step, { draft, runtime })
      if (typeChoice && !lockedType) {
        if (access.state === 'ready') recordConfirmedType(access.vendorId, typeChoice)
        setSavedType({ status: 'saved', type: typeChoice })
      }
    }

    completeStep(step, nextStep)
    if (inPlace) feedback.show('Changes saved.', 'success')
  }

  /** A Step 3 save of `type` reached the account: lock it now and for later visits. */
  const confirmTypeSave = (vendorId: string, type: BusinessTypeReference) => {
    if (useAuthStore.getState().user?.vendorId !== vendorId) return
    recordConfirmedType(vendorId, type)
    setSavedType({ status: 'saved', type })
    entryRef.current?.confirmSavedType(type)
  }

  /**
   * A first type save failed. A refusal from the server is definite, so the choice reopens.
   * Anything else (a timeout, a lost connection, a server error, leaving mid-request) may have
   * saved it, so the type is checked against a fresh account read before anything else.
   */
  const settleFailedTypeSave = (vendorId: string, error: unknown) => {
    const definite = isApiError(error) && error.status >= 400 && error.status < 500
    if (!definite) dropWrittenAccountData(vendorId, savedResources(3))
    if (useAuthStore.getState().user?.vendorId !== vendorId) return
    if (definite) clearTypeSaveInFlight(vendorId)
    else entryRef.current?.recheckSavedType()
  }

  /**
   * What a Step 7 or 8 save sends: this step's input with the other step's saved values. If
   * those are unknown this visit, the account's checkout is read first.
   */
  const checkoutSaveInput = async (
    step: 7 | 8,
    vendorId: string,
    draft: OnboardingState['draft'],
    runtime: OnboardingState['runtime'],
  ) => {
    const known = checkoutWriteInput(step, draft, runtime, useOnboardingStore.getState().savedBaselines)
    if (known) return known
    invalidateOnboardingResources(vendorId, ['checkout'])
    const fromAccount = checkoutBaselines(await loadAccountResource(vendorId, 'checkout'))
    const sibling: SavedBaselines = step === 7 ? { 8: fromAccount[8] } : { 7: fromAccount[7] }
    if (useAuthStore.getState().user?.vendorId === vendorId) recordSavedBaselines(sibling)
    return checkoutWriteInput(step, draft, runtime, sibling)!
  }

  /**
   * The saved step's values become its baseline: what was sent, or, for catalog steps whose
   * save rewrites authored ids, the draft as it stands after the save.
   */
  const recordSavedStep = (
    step: OnboardingStep,
    sent: { draft: OnboardingState['draft']; runtime: OnboardingState['runtime'] },
  ) => {
    if (!isAccountStep(step)) return
    const source = step >= 4 && step <= 6 ? useOnboardingStore.getState() : sent
    recordSavedBaselines({ [step]: stepSnapshot(step, source.draft, source.runtime) })
  }

  const handleContinue = async () => {
    const { draft } = useOnboardingStore.getState()
    setStatusMessage(null)
    if (draft.currentStep === 1) return handleOtpRequest()
    if (draft.currentStep === 2) return handleOtpVerify()
    if (!catalogUnlocked) return

    // A draft created in demo mode can survive a later deployment/configuration change.
    // Route both outcomes through the pure boundary: sample must not retain the old
    // silent-success path after its controls disappear, and allowed work cannot bypass it.
    return continueWithCatalogPolicy(catalogPolicy, {
      blocked: () => showIssues([{
        step: draft.currentStep,
        field: stepErrorField(draft.currentStep),
        message: 'The sample catalog is available only in demo mode. Start over to load the account catalog before continuing.',
      }]),
      allowed: handleCatalogContinue,
    })
  }

  const changeOtpPhone = () => {
    cancelActiveRequest()
    setShownIssues(NO_ISSUES)
    setStatusMessage(null)
    const phone = useOnboardingStore.getState().runtime.phone
    useOnboardingStore.getState().updatePhone(phone)
    navigateToStep(1)
  }

  const navigateToStep = (step: OnboardingStep) => {
    cancelActiveRequest()
    // The floor is the single clamp: below it the identity steps are closed, and above
    // it Step 2 without a number to verify is a dead end, so it becomes Step 1.
    const target = Math.max(step, firstNavigableStep) as OnboardingStep
    goToStep(target <= 2 && !useOnboardingStore.getState().runtime.phone ? 1 : target)
  }

  const goBack = () => {
    if (currentStep > firstNavigableStep) navigateToStep((currentStep - 1) as OnboardingStep)
  }

  // The single verb for leaving a setup — from the header, the ready-vendor floor, and
  // the two dead-end notices. It signs out, because that is the only honest thing "start
  // over" can do: assignment is one-way, so there is no clean slate to hand back. Signing
  // out abandons this browser's draft; signing back in on the same number rebuilds it
  // from the authoritative account catalog. It cancels any in-flight save first so a
  // pending request cannot race the sign-out.
  const confirmStartOver = () => requestConfirmation({
    title: 'Start over?',
    description:
      'You will be signed out. Your saved details are safe.',
    confirmLabel: 'Start over',
    tone: 'danger',
    onConfirm: () => {
      cancelActiveRequest()
      void logout()
    },
  })

  const stepMeta = currentStep === 10 && storeIsSubmitted
    ? {
        ...ONBOARDING_STEPS[9],
        title: 'Your store',
        description: storeIsApproved ? 'Share your store link.' : 'Submitted for review. You can still add categories and products.',
      }
    : ONBOARDING_STEPS[currentStep - 1]
  const stepDescription = stepMeta.description.replace('{categoryLimit}', String(categoryLimit))
  // Step 9's approval note applies only to unfinished setup, not published-store editing.
  const saveNote = !stepMeta.saveNote || !catalogUnlocked ? null
    : currentStep === 9 ? (liveApi && !storeIsSubmitted ? stepMeta.saveNote : null)
      : writesReachAccount(catalogSource) ? stepMeta.saveNote : null
  // A submitted store needs no further setup whatever the local draft says:
  // `storeSubmission` comes from the account, so "Complete setup" has nothing to do.
  const setupNeedsNoFurtherAction =
    storeIsSubmitted || (publicationState === 'prototype-complete' && completedSteps.includes(10))
  // Whether the Step 10 action writes to the account (live submission) or saves a private
  // in-browser preview (demo or sample). Mirrors the branch in `handleCatalogContinue`, so
  // the button label, the confirmation, and the actual effect can never disagree.
  const step10SubmitsToAccount = writesReachAccount(catalogSource) && access.state === 'ready'
  const stepSavesInPlace = savesInPlace(currentStep, storeIsSubmitted, storeIsApproved)
  // "Review readiness" promises a check that only means something before submission.
  const continueLabel = currentStep === 1 ? 'Send OTP'
    : currentStep === 2 ? 'Verify & continue'
      // Approved size and branding edits save without moving on.
      : stepSavesInPlace ? 'Save changes'
      // A submitted store only writes on the additive catalog steps; everywhere else
      // Continue is pure navigation, so the label must not promise a save.
      : storeIsSubmitted ? (isAdditiveCatalogStep(currentStep, storeIsApproved) ? 'Save and continue' : 'Continue')
        // Revisiting an earlier step: saving returns to where the vendor came from.
        : returnStep !== null && currentStep < returnStep ? 'Save changes'
        : currentStep === 9 ? 'Review readiness'
          // Live submits for administrator review; demo/sample only saves a private preview.
          : currentStep === 10 ? (step10SubmitsToAccount ? 'Submit for review' : 'Save private preview')
            : 'Continue'
  const sampleCatalogFallback = catalogPolicy.canSwitchTo('sample')
    ? requestSampleCatalog
    : undefined
  const moveMobileTab = (view: 'form' | 'preview') => {
    setMobileView(view)
    window.setTimeout(() => document.getElementById(`onboarding-${view}-tab`)?.focus(), 0)
  }
  const stepperProps = { currentStep, completedSteps, furthestVisitedStep, firstNavigableStep, catalogAdditiveOpen: storeIsSubmitted, storeIsApproved, attentionSteps }

  // A live, signed-in step from 3 on shows its form only once what it needs has loaded.
  const accountReadsApply = liveApi && access.state === 'ready' && catalogUnlocked && currentStep >= 3
  // Steps 3 and 4 show the saved type and Step 10 checks it, so they wait while it is checked.
  // Steps 3 and 4 have nothing to offer while it is unconfirmed but a fresh check.
  const typeGated = accountReadsApply && catalogSource === 'account' && stepNeedsSavedType(currentStep, storeIsSubmitted)
  const typeUnresolved = typeGated && currentStep !== 10 && savedType.status === 'unresolved'
  const accountState = !accountReadsApply ? 'loaded'
    // Every step's reads depend on the context, so none is usable without it.
    : loadView.context === 'failed' ? 'failed'
      // A sample draft has no account copy to wait for.
      : catalogSource !== 'account' ? 'loaded'
        : stepLoadState(currentStep, { submitted: storeIsSubmitted, approved: storeIsApproved, resources: loadView.resources, units: loadView.units })
  const typeState = accountState !== 'loaded' || !typeGated ? accountState
    : savedType.status === 'checking' ? 'loading'
      : typeUnresolved ? 'failed' : 'loaded'
  // A confirmed mixed saved catalog: Steps 4-6 offer support instead of changes.
  const catalogBlocked = accountReadsApply && catalogMixed && !storeIsSubmitted && currentStep >= 4 && currentStep <= 6
  const stepState = catalogBlocked ? 'failed'
    : typeUnresolved || !accountReadsApply || catalogSource !== 'account'
      ? typeState
      : waitsForFirstList(typeState, currentStep, loadView)
  const contextPending = liveApi && access.state === 'ready' && (loadView.context === 'idle' || loadView.context === 'loading')

  if (!persistenceInitialized || contextPending) {
    // One gate for both reads. Painting between them shows Step 3 to a vendor whose
    // account puts them on Step 9, and then moves the form under them.
    return (
      <div className="onboarding-shell grid h-full min-h-0 place-items-center">
        <PageLoader label={persistenceInitialized ? 'Restoring your setup' : 'Restoring browser draft'} />
      </div>
    )
  }

  return (
    <div className="onboarding-shell h-full min-h-0 overflow-hidden marketing-gutter text-[var(--ob-ink)] [contain:paint]">
      <div className="ob-grid marketing-measure w-full">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="grid shrink-0 grid-cols-2 gap-1 py-2 min-[900px]:hidden" role="tablist" aria-label="Onboarding view">
            <button id="onboarding-form-tab" type="button" role="tab" tabIndex={mobileView === 'form' ? 0 : -1} aria-controls="onboarding-form-panel" aria-selected={mobileView === 'form'} onClick={() => setMobileView('form')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveMobileTab('preview') } }} className={cn('rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', mobileView === 'form' && 'bg-[var(--ob-sheet)] text-[var(--ob-ink)] shadow-sm')}>Set up</button>
            <button id="onboarding-preview-tab" type="button" role="tab" tabIndex={mobileView === 'preview' ? 0 : -1} aria-controls="onboarding-preview-panel" aria-selected={mobileView === 'preview'} onClick={() => setMobileView('preview')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveMobileTab('form') } }} className={cn('flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', mobileView === 'preview' && 'bg-[var(--ob-sheet)] text-[var(--ob-ink)] shadow-sm')}><EyeIcon className="size-4" /> Your shop</button>
          </div>

          <div className="min-h-0 flex-1">
            <main id="onboarding-form-panel" role="tabpanel" aria-labelledby="onboarding-form-tab" className={cn('h-full min-h-0 min-w-0', mobileView === 'preview' ? 'hidden min-[900px]:block' : 'block')}>
              <section className="flex h-full min-h-0 flex-col">
                {/* The stepper, status and footer reserve the form's scrollbar gutter, so all
                    four rows share one right edge. */}
                <div className="shrink-0 overflow-hidden [scrollbar-gutter:stable]">
                  <OnboardingStepper {...stepperProps} onNavigate={navigateToStep} />
                  {currentStep >= 3 && currentStep < 10 && (!liveApi || storeIsSubmitted) ? (
                    <div className="border-b border-[var(--ob-line)]">
                      <OnboardingStatus demo={!liveApi} submitted={storeIsSubmitted} approved={storeIsApproved} />
                    </div>
                  ) : null}
                </div>

                <div ref={formScrollRef} id="onboarding-form-scroll" className="@container/onboarding-form -mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-4 pb-8 [scrollbar-gutter:stable] min-[900px]:pt-5">
                  <div className="w-full">
                    <div className={identityStep ? 'mx-auto flex w-full max-w-[24rem] flex-col-reverse gap-y-2 pt-6 sm:pt-10' : 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5'}>
                      {/* Off the identity steps the title shares its row with the actions and
                          the description spans both columns, so a phone never squeezes the
                          description into the width the actions leave over. */}
                      <div className={identityStep ? 'text-center' : 'contents'}>
                        <h1 ref={headingRef} tabIndex={-1} className={cn('font-display text-[var(--ob-ink)] outline-none', identityStep ? 'text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-3xl' : 'text-[1.625rem] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[1.875rem]')}>{stepMeta.title}</h1>
                        {currentStep === 2 && identityStep ? (
                          <OtpSentTo busy={busy} onChangePhone={changeOtpPhone} />
                        ) : (
                        <p className={identityStep ? 'mt-2 text-balance text-[0.9375rem] leading-relaxed text-[var(--ob-ink-soft)]' : 'col-span-2 max-w-2xl text-sm leading-6 text-[var(--ob-ink-soft)]'}>
                          {stepMeta.emphasis
                            ? stepDescription.split(stepMeta.emphasis).flatMap((part, index) => index
                              ? [<strong key={index} className="font-semibold text-[var(--ob-ink)]">{stepMeta.emphasis}</strong>, part]
                              : [part])
                            : stepDescription}
                        </p>
                        )}
                      </div>
                      {/* The catalog-source toggle and "Start over" both act on the browser
                          draft, and a submitted store is one an administrator holds — neither can
                          touch it, so it is shown neither. "Start over" additionally needs a
                          resolved vendor session to sign out of: the anonymous identity steps have
                          nothing to end, and the dead-end notices below carry their own instead. */}
                      <div className={cn('-mr-1 flex shrink-0 items-center gap-1 pt-1', identityStep ? 'self-end empty:hidden' : 'col-start-2 row-start-1')}>
                        {storeIsSubmitted ? null : <>
                        {catalogPolicy.sampleControlVisible ? (
                        <button
                          type="button"
                          disabled={busy || !catalogPolicy.canSwitchTo(catalogSource === 'account' ? 'sample' : 'account')}
                          onClick={catalogSource === 'account' ? requestSampleCatalog : requestLiveCatalog}
                          aria-label={`${catalogSource === 'account' ? 'Live' : 'Sample'} catalog. Change catalog mode.`}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50',
                            catalogSource === 'account'
                              ? 'text-[var(--ob-ink-soft)] hover:bg-[var(--ob-sheet)] hover:text-[var(--ob-ink)]'
                              : 'bg-amber-100 text-amber-900 hover:bg-amber-200/80 dark:bg-amber-950/45 dark:text-amber-200',
                          )}
                        >
                          <DatabaseIcon className="size-3.5" aria-hidden="true" />
                          <span className="sm:hidden">{catalogSource === 'account' ? 'Live' : 'Sample'}</span>
                          <span className="hidden sm:inline">{catalogSource === 'account' ? 'Live catalog' : 'Sample catalog'}</span>
                        </button>
                        ) : null}
                        {catalogUnlocked ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={confirmStartOver}
                          aria-label="Start over"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors hover:bg-[var(--ob-sheet)] hover:text-[var(--ob-ink)] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]"
                        >
                          <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                          <span className="hidden min-[700px]:inline">Start over</span>
                        </button>
                        ) : null}
                        </>}
                      </div>
                    </div>

                    <div>
                      {persistenceStatus === 'unavailable' ? <p role="status" className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">Browser recovery unavailable. This session continues in memory.</p> : null}

                      {/* Keyed on the step so each one arrives rather than swapping in place. */}
                      <div key={currentStep} className="ob-step-enter mt-6">
                        {currentStep === 1 && !identitySettled ? <PhoneStep issues={issues} busy={busy} statusMessage={statusMessage} onContinue={() => void handleContinue()} /> : null}
                        {currentStep === 2 && !identitySettled ? <OtpStep issues={issues} busy={busy} statusMessage={statusMessage} onContinue={() => void handleContinue()} onResend={resendOtp} /> : null}
                        {catalogUnlocked && storeIsSubmitted && currentStep === 6 && !storeIsApproved ? (
                          <div className="mb-4"><StepNotice tone="info" message="Sizes and prices unlock after approval." /></div>
                        ) : null}
                        {catalogUnlocked && currentStep >= 3 && contextError ? (
                          <div className="mb-4"><StepNotice tone="error" message={contextError} /></div>
                        ) : null}
                        {!catalogUnlocked && (currentStep >= 3 || identitySettled) ? (
                          <AccessNotice access={access} onSelectVendor={selectVendor} onSignOut={confirmStartOver} />
                        ) : null}
                        {/* A `fieldset` rather than a per-input `disabled` prop: read-only has to
                            hold for every control on the locked steps, and threading
                            a flag through those step components is a rule anything new can be added
                            without. Categories/products and an approved store's sizes/branding stay interactive;
                            Step 10 is the landing step and stays
                            interactive too. The notices above carry the sign-out action, which
                            stays available because it is the only route backwards. Step 3 locks
                            only its cards, so its list can still be searched and paged. */}
                        {stepState === 'loading' ? <PageLoader label="Loading this step" /> : null}
                        {stepState === 'failed' ? <>
                          {currentStep === 9 && storeIsSubmitted && storeIsApproved ? <p className="mb-3 text-sm text-destructive">Could not load your saved store settings. Retry before making changes.</p> : null}
                          {catalogBlocked ? <StepNotice tone="error" message={MIXED_CATALOG_MESSAGE} />
                            : typeUnresolved && savedType.status === 'unresolved'
                            ? <LoadError message={unresolvedTypeMessage(savedType.retried)} onRetry={() => entryRef.current?.recheckSavedType()} />
                            : <LoadError onRetry={() => entryRef.current?.retry(currentStep)} />}
                        </> : null}
                        {stepState === 'loaded' && writesReachAccount(catalogSource) && (currentStep === 10 || (currentStep === 9 && submittedStepIsReadOnly(9, storeIsSubmitted, storeIsApproved))) ? (
                          <div className="space-y-3 empty:hidden [&:not(:empty)]:mb-5">
                            {(['logo', 'banner'] as const).filter((kind) => loadView.resources[kind] === 'failed').map((kind) => (
                              <StoreImageLoadNotice key={kind} kind={kind} onRetry={() => entryRef.current?.retryImage(kind)} />
                            ))}
                          </div>
                        ) : null}
                        <fieldset
                          disabled={(currentStep === 9 && busy) || (currentStep !== 3 && submittedStepIsReadOnly(currentStep, storeIsSubmitted, storeIsApproved))}
                          className="min-w-0 border-0 p-0"
                        >
                        {stepState === 'loaded' ? <>
                          {currentStep === 3 && catalogUnlocked && catalogPolicy.referenceReadsAllowed ? <BusinessStep issues={inlineIssues} onUseSample={sampleCatalogFallback} readOnly={submittedStepIsReadOnly(3, storeIsSubmitted, storeIsApproved)} /> : null}
                          {currentStep === 4 && catalogUnlocked && catalogPolicy.referenceReadsAllowed ? <CategoryStep issues={inlineIssues} confirm={requestConfirmation} onUseSample={sampleCatalogFallback} /> : null}
                          {currentStep === 5 && catalogUnlocked && catalogPolicy.referenceReadsAllowed ? <ProductStep issues={inlineIssues} confirm={requestConfirmation} onUseSample={sampleCatalogFallback} markMissing={attentionSteps.includes(5)} /> : null}
                          {currentStep >= 3 && currentStep <= 5 && catalogUnlocked && !catalogPolicy.referenceReadsAllowed ? (
                            <StepNotice message={currentStep === 3
                              ? 'Demo mode does not load your account catalog. Choose Sample catalog above to continue.'
                              : 'Demo mode cannot load an account-catalog draft. Start over and choose Sample catalog before continuing.'}
                            />
                          ) : null}
                          {currentStep === 6 && catalogUnlocked ? <SkuStep issues={issues} markMissing={attentionSteps.includes(6)} /> : null}
                          {currentStep === 7 && catalogUnlocked ? <DeliveryStep issues={issues} /> : null}
                          {currentStep === 8 && catalogUnlocked ? <PaymentStep issues={issues} /> : null}
                          {currentStep === 9 && catalogUnlocked ? <StorefrontStep issues={issues} savesInPlace={stepSavesInPlace} imageStates={writesReachAccount(catalogSource) ? { logo: loadView.resources.logo, banner: loadView.resources.banner } : undefined} onRetryImage={submittedStepIsReadOnly(9, storeIsSubmitted, storeIsApproved) ? undefined : (kind) => entryRef.current?.retryImage(kind)} /> : null}
                          {currentStep === 10 && catalogUnlocked ? <ReviewStep issues={issues} onGoToStep={navigateToStep} submitsToAccount={step10SubmitsToAccount} /> : null}
                        </> : null}
                        </fieldset>
                      </div>
                    </div>
                  </div>
                </div>

                {currentStep >= 3 ? <div className="-mx-1 shrink-0 overflow-hidden px-1 [scrollbar-gutter:stable]">
                  <div className="flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-[var(--ob-line)] py-3">
                    {saveNote ? (
                      <p className="flex min-w-0 basis-full items-center gap-1.5 text-xs leading-5 text-[var(--ob-ink-soft)] sm:mr-auto sm:basis-0 sm:grow">
                        <InfoIcon className="size-3.5 shrink-0 text-[var(--ob-brand)]" aria-hidden="true" />
                        <span>{saveNote}</span>
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      {currentStep > firstNavigableStep ? <Button variant="ghost" disabled={busy} onClick={goBack}><ArrowLeftIcon /> Back</Button> : null}
                      {!(currentStep === 10 && setupNeedsNoFurtherAction) && !(currentStep >= 3 && !catalogUnlocked) && !(currentStep <= 2 && identitySettled) ? <Button className="h-11 px-6 sm:min-w-48" disabled={stepState !== 'loaded'} pending={busy} onClick={() => void handleContinue()}>{continueLabel}{!busy ? <ArrowRightIcon /> : null}</Button> : null}
                    </div>
                  </div>
                </div> : null}
              </section>
            </main>
            <PhonePreviewStage id="onboarding-preview-panel" labelledBy="onboarding-preview-tab" className={cn('h-full min-[900px]:hidden', mobileView === 'form' ? 'hidden' : 'flex')} />
          </div>
        </div>

        <PhonePreviewStage className="ob-bay hidden h-full min-[900px]:flex" />
      </div>

      <ConfirmDialog {...confirmState} onOpenChange={(open) => setConfirmState((current) => ({ ...current, open }))} />
    </div>
  )
}
