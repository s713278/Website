import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DatabaseIcon,
  EyeIcon,
  InfoIcon,
  LockKeyholeIcon,
  Loader2Icon,
  RotateCcwIcon,
  StoreIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  authService,
  getErrorMessage,
  isLiveApi,
  vendorOnboardingService,
  type MeasurementCatalog,
  type VendorContext,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, LoadingSkeleton } from '@/shared/components/ui'
import { useOnboardingDraftSession } from '../../hooks/use-onboarding-draft-session'
import { canEnterCatalogSteps, navigationFloor } from '../../lib/onboarding-access'
import { peekMeasurementCatalog } from '../../lib/measurement-catalog-cache'
import {
  invalidateOnboardingResources,
  peekOnboardingResource,
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
  backendResumeStep,
  derivedResumeStep,
  isStoreSubmitted,
  loadAccountResource,
  measurementCatalogsForResume,
  resolveBusinessType,
  resumeOrderWhatsapp,
  resumePaymentDetails,
  savedBusinessType,
  stepLoadState,
  stepResources,
  type OnboardingResource,
  type ResourceStatus,
} from '../../lib/onboarding-resume'
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
import { additiveCatalogIssues, normalizeDraftSlug, readinessIssues, validateStep } from '../../lib/onboarding-validation'
import { invalidateVendorContext, loadVendorContext, peekVendorContext } from '../../lib/vendor-context-cache'
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
import { OtpStep, PhoneStep } from './IdentitySteps'
import { DeliveryStep, PaymentStep, SkuStep } from './OperationsSteps'
import { CorruptDraftDialog, DraftConflictDialog } from './RecoveryDialogs'
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

function LivePreviewPane() {
  const draft = useOnboardingStore((state) => state.draft)
  const logoUrl = useOnboardingStore((state) => state.runtime.logoUrl)
  const bannerUrl = useOnboardingStore((state) => state.runtime.bannerUrl)
  const deferredDraft = useDeferredValue(draft)
  return <StorefrontPreview draft={deferredDraft} logoUrl={logoUrl} bannerUrl={bannerUrl} />
}

/** The bay where the shop takes shape: the storefront as a customer will see it. */
function PhonePreviewStage({ className, id, labelledBy }: { className?: string; id?: string; labelledBy?: string }) {
  return (
    <aside
      id={id}
      role={labelledBy ? 'tabpanel' : undefined}
      aria-labelledby={labelledBy}
      className={cn('onboarding-preview-stage relative min-h-0', className)}
      aria-label={labelledBy ? undefined : 'Storefront preview'}
    >
      <div className="flex w-full max-w-[17.5rem] shrink-0 items-center gap-2 text-[var(--ob-ink-soft)]">
        <StoreIcon className="size-3.5" aria-hidden="true" />
        <span className="ob-eyebrow">Live preview</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium">
          <LockKeyholeIcon className="size-2.5" aria-hidden="true" />
          Private
        </span>
      </div>
      <LivePreviewPane />
      <PreviewStats className="shrink-0" />
    </aside>
  )
}

/** A step's form area while the account data it needs is read. */
function StepSkeleton() {
  return (
    <div role="status" aria-label="Loading this step" aria-busy="true" className="space-y-3">
      <LoadingSkeleton className="h-10 rounded-xl" />
      <LoadingSkeleton className="h-24 rounded-xl" />
      <LoadingSkeleton className="h-24 rounded-xl" />
    </div>
  )
}

/** In place of a step's form when a read it needs failed. */
function StepLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <StepNotice message="Something went wrong" />
      <Button variant="outline" onClick={onRetry}><RotateCcwIcon /> Try again</Button>
    </div>
  )
}

type OnboardingState = ReturnType<typeof useOnboardingStore.getState>

/**
 * Recomputes, from the store as it is now, the issues a validation reported on Continue.
 * Only validation-origin issues carry one; a server or request failure has nothing to
 * re-run, so it stays until the next action.
 */
type IssueRecheck = (state: OnboardingState) => ValidationIssue[]

type ShownIssues = { issues: ValidationIssue[]; recheck?: IssueRecheck }

const NO_ISSUES: ShownIssues = { issues: [] }

const ACCOUNT_RESOURCES: readonly OnboardingResource[] = ['profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout']
/** The steps whose draft each resource's applier fills. */
const RESOURCE_STEPS: Record<OnboardingResource, readonly OnboardingStep[]> = {
  profile: [3, 9], businessTypes: [3], categories: [4], products: [5], skus: [6], checkout: [7, 8],
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

/** Where this visit's account reads stand: the context, each resource and the units. */
type AccountLoadView = {
  context: ResourceStatus
  resources: Record<OnboardingResource, ResourceStatus>
  units: ResourceStatus
}

const IDLE_LOAD_VIEW: AccountLoadView = {
  context: 'idle',
  resources: {
    profile: 'idle', businessTypes: 'idle', categories: 'idle', products: 'idle', skus: 'idle', checkout: 'idle',
  },
  units: 'idle',
}

type AccountEntry = {
  /** Start, or join, whatever the step needs that this visit has not read yet. */
  requestStep: (step: OnboardingStep) => void
  /** Start the step's account reads ahead of it opening, without touching this visit's view. */
  prefetchStep: (step: OnboardingStep) => void
  /** Re-read the context if it failed, and the step's failed resources. */
  retry: (step: OnboardingStep) => void
  cancel: () => void
}

/**
 * One wizard visit's reads of the vendor's account, applied to the draft as each lands.
 *
 * The context and the profile are read at once; every other resource only when a step
 * that needs it opens. Each result is applied the moment it lands, whatever step is on
 * screen, through the per-resource appliers: a step with unsaved edits keeps them unless
 * the store is submitted. Nothing is applied without a context. A result for a visit that
 * has ended, or for another vendor, is dropped.
 */
function startAccountEntry(
  vendorId: string,
  hooks: {
    setView: (view: AccountLoadView) => void
    setContextError: (message: string | null) => void
    savedSteps: { current: Partial<Record<OnboardingStep, string>> }
  },
): AccountEntry {
  let cancelled = false
  const view: AccountLoadView = { ...IDLE_LOAD_VIEW, resources: { ...IDLE_LOAD_VIEW.resources } }
  const values: Partial<OnboardingResourceData> = {}
  // `undefined` while unsettled; `null` after a failed read, which falls back to sample units.
  let units: MeasurementCatalog | null | undefined
  const applied = new Set<OnboardingResource>()
  const vouched = new Set<OnboardingStep>()
  let context: VendorContext | null = null
  // The step the account resumes at, which bounds the steps a resume vouches for.
  let resumeAt: OnboardingStep | null = null
  // No usable pointer: the step is derived once every resource has been read.
  let derivePending = false

  const store = () => useOnboardingStore.getState()
  const isCurrent = () => !cancelled && useAuthStore.getState().user?.vendorId === vendorId
  const publish = () => hooks.setView({ ...view, resources: { ...view.resources } })

  const landValue = <R extends OnboardingResource>(resource: R, value: OnboardingResourceData[R]) => {
    if (view.resources[resource] === 'loaded') return
    values[resource] = value
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

  const applyFrame = (openAt: OnboardingStep) => {
    const state = store()
    const draft = applyResumeFrame(state.draft, openAt, {
      edited: new Set(),
      submitted: selectStoreIsSubmitted(state),
    })
    state.applyResumedDraft(
      draft,
      openAt,
      { paymentDetails: state.runtime.paymentDetails, orderWhatsapp: '' },
      { frameApplied: true },
    )
  }

  /** Every applier whose inputs have landed and that has not run yet, in one draft write. */
  const applyReady = () => {
    if (!context) return
    const state = store()
    const submitted = selectStoreIsSubmitted(state)
    const approved = selectStoreIsApproved(state)
    const options = { edited: new Set(state.editedSteps), submitted }
    const keptLocal = (step: OnboardingStep) => !submitted && options.edited.has(step)
    let draft = state.draft
    let paymentDetails = state.runtime.paymentDetails
    let orderWhatsapp = ''
    const ran = (resource: OnboardingResource) => applied.add(resource)

    if (!applied.has('profile') && view.resources.profile === 'loaded') {
      draft = applyProfile(draft, values.profile!, options)
      if (!keptLocal(9)) orderWhatsapp = resumeOrderWhatsapp(values.profile!)
      ran('profile')
    }
    const businessType = view.resources.profile === 'loaded' && view.resources.businessTypes === 'loaded'
      ? resolveBusinessType(values.profile!, values.businessTypes!)
      : undefined
    if (!applied.has('businessTypes') && businessType !== undefined) {
      draft = applyBusinessType(draft, businessType, options)
      ran('businessTypes')
    }
    if (!applied.has('categories') && view.resources.categories === 'loaded' && businessType !== undefined) {
      draft = applyCategories(draft, values.categories!, businessType, options)
      ran('categories')
    }
    if (!applied.has('products') && view.resources.products === 'loaded') {
      draft = applyProducts(draft, values.products!, options)
      ran('products')
    }
    // Saved sizes are rebuilt against the units, so they wait for them (or their fallback).
    if (!applied.has('skus') && view.resources.skus === 'loaded' && view.resources.products === 'loaded' && units !== undefined) {
      draft = applySkus(draft, values.skus!, values.products!, measurementCatalogsForResume(units).measurements, options)
      ran('skus')
    }
    if (!applied.has('checkout') && view.resources.checkout === 'loaded') {
      draft = applyCheckout(draft, values.checkout!, options)
      if (!keptLocal(8)) paymentDetails = resumePaymentDetails(values.checkout!, paymentDetails)
      ran('checkout')
    }
    if (draft !== state.draft || paymentDetails !== state.runtime.paymentDetails || orderWhatsapp) {
      state.applyResumedDraft(draft, state.furthestVisitedStep, { paymentDetails, orderWhatsapp }, { frameApplied: false })
    }

    if (derivePending && ACCOUNT_RESOURCES.every((resource) => applied.has(resource))) {
      derivePending = false
      resumeAt = derivedResumeStep(accountResumeState(context, values as OnboardingResourceData))
      // Only while the vendor is still where the fallback put them, with nothing edited.
      const latest = store()
      if (!latest.editedSteps.length && latest.draft.currentStep === 10) applyFrame(resumeAt)
    }

    const loadedSteps = ACCOUNT_STEPS.filter((step) =>
      stepResources(step, { submitted, approved }).account.every((resource) => applied.has(resource)))
    store().setLoadedSteps(loadedSteps)

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

  const track = (resource: OnboardingResource | 'units', read: Promise<unknown>) => {
    if (resource === 'units') view.units = 'loading'
    else view.resources[resource] = 'loading'
    read.then(
      (value) => {
        if (!isCurrent()) return
        if (resource === 'units') settleUnits(value as MeasurementCatalog)
        else landValue(resource, value as OnboardingResourceData[typeof resource])
        applyReady()
        publish()
      },
      () => {
        if (!isCurrent()) return
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
    // Already-read values apply now, so a step whose data is cached never shows a skeleton.
    for (const resource of needs.account) {
      if (view.resources[resource] !== 'idle') continue
      if (resource === 'businessTypes' && view.resources.profile === 'loaded') {
        // The profile decides whether business types are needed at all.
        if (!savedBusinessType(values.profile!)) {
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
    const reads = loadStepResources(vendorId, step, { submitted, approved, withUnits: true, skip })
    for (const resource of Object.keys(reads) as (OnboardingResource | 'units')[]) {
      track(resource, reads[resource]!)
    }
    applyReady()
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
      || (!submitted && RESOURCE_STEPS[resource].every((owner) => edited.has(owner))))
    if (view.resources.profile === 'failed') skip.push('businessTypes')
    // Not tracked: the step's own request joins these reads, or finds them cached, when it opens.
    loadStepResources(vendorId, step, { submitted, approved, withUnits: false, skip })
  }

  const applyContext = (loaded: VendorContext) => {
    context = loaded
    const state = store()
    hooks.setContextError(null)
    state.setCategoryLimit(loaded.subscription.limits.maxCategories)
    state.setProductLimit(loaded.subscription.limits.maxProducts)
    state.setSkuLimit(loaded.subscription.limits.maxSkus)
    state.setAccountCatalog({ skuUsage: loaded.subscription.usage.skus })
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
    resumeAt = submitted ? 10 : backendResumeStep(loaded)
    // Unsaved local work is newest only while setup can still accept it: the vendor's own
    // progress then stands. Once the store is submitted the account wins every step.
    if (!state.editedSteps.length || submitted) {
      // Without a usable pointer, Step 10 reads everything and the step is derived from it.
      derivePending = resumeAt === null
      applyFrame(resumeAt ?? 10)
    }
    view.context = 'loaded'
    applyReady()
    publish()
  }

  const readContext = () => {
    // Sign-in or the header may have read it already: applying it now keeps the very
    // first paint correct, instead of one frame of the un-hydrated draft.
    const known = peekVendorContext(vendorId)
    if (known) return applyContext(known)
    view.context = 'loading'
    publish()
    loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id)).then(
      (loaded) => {
        if (isCurrent()) applyContext(loaded)
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

  startProfile()
  readContext()

  return {
    requestStep,
    prefetchStep,
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
      publish()
    },
    cancel() {
      cancelled = true
    },
  }
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
    return readinessIssues(draft, runtime, categoryLimit, measurementCatalog, enforcement)
  }
  // Validate additions without reopening whole-store readiness for submitted vendors.
  return selectStoreIsSubmitted(state)
    ? additiveCatalogIssues(draft.currentStep, draft, categoryLimit, enforcement, measurementCatalog)
    : validateStep(draft.currentStep, draft, runtime, categoryLimit, measurementCatalog, enforcement)
}

const phoneIssues: IssueRecheck = (state) => validateStep(1, state.draft, state.runtime)

const OTP_INCOMPLETE: ValidationIssue = { step: 2, field: 'otp-0', message: 'Enter all four digits before verifying.' }
const otpIssues: IssueRecheck = (state) => state.runtime.otpDigits.some((digit) => !digit) ? [OTP_INCOMPLETE] : []

/**
 * A submitted store is read-only except for categories/products, approved size additions,
 * and the Step 10 status view. The Continue handler and the
 * `fieldset` guard both read this one predicate so they cannot drift out of lockstep.
 */
function submittedStepIsReadOnly(step: OnboardingStep, submitted: boolean, approved: boolean): boolean {
  return submitted && step < 10 && !isAdditiveCatalogStep(step, approved)
}

export function OnboardingWizard() {
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
  const loadNewerDraft = useOnboardingStore((state) => state.loadNewerDraft)
  const overwriteWithCurrentDraft = useOnboardingStore((state) => state.overwriteWithCurrentDraft)
  const clearCorruptDraft = useOnboardingStore((state) => state.clearCorruptDraft)
  const setCategoryLimit = useOnboardingStore((state) => state.setCategoryLimit)
  const setProductLimit = useOnboardingStore((state) => state.setProductLimit)
  const setSkuLimit = useOnboardingStore((state) => state.setSkuLimit)
  const setStoreSubmission = useOnboardingStore((state) => state.setStoreSubmission)
  const setAccountCatalog = useOnboardingStore((state) => state.setAccountCatalog)
  const setProductMeasurementCatalog = useOnboardingStore((state) => state.setProductMeasurementCatalog)
  const recordAssignment = useOnboardingStore((state) => state.recordAssignment)
  const recordCreatedEntry = useOnboardingStore((state) => state.recordCreatedEntry)
  const setLoadedSteps = useOnboardingStore((state) => state.setLoadedSteps)
  // Read from the account, not the draft: a browser can claim setup needs no more work when
  // nothing ever reached an account. Once true, setup shows what was sent and stops
  // offering controls that cannot reach a store already under review.
  const storeIsSubmitted = useOnboardingStore(selectStoreIsSubmitted)
  const storeIsApproved = useOnboardingStore(selectStoreIsApproved)
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
  // Errors render inline on each step, so this polite region is what tells a screen-reader
  // user a Continue failed. `count` re-keys the text so a repeat of the same message is
  // announced again; it reads empty once the shown issues clear (a fix, a step change).
  const [issueAnnouncement, setIssueAnnouncement] = useState({ text: '', count: 0 })
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  // Where this visit's account reads stand. The wizard must not paint an interactive step
  // before the context has been read (Step 3 would flash and then jump to wherever the
  // resume lands), and a step's form waits for the resources that step needs.
  const [loadView, setLoadView] = useState<AccountLoadView>(IDLE_LOAD_VIEW)
  const entryRef = useRef<AccountEntry | null>(null)
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
   * now and each step's other resources when that step opens (below). It never overwrites
   * a step the vendor has edited and not yet saved.
   */
  useLayoutEffect(() => {
    savedStepRef.current = {}
    // Which steps hold account data is known only for this visit; the entry sets it again
    // as each read lands.
    setLoadedSteps([])
    setLoadView(IDLE_LOAD_VIEW)
    setContextError(null)
    if (access.state !== 'ready') {
      setCategoryLimit(null)
      setProductLimit(null)
      setSkuLimit(null)
      setStoreSubmission(null)
      setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [], skuUsage: null })
      if (isLiveApi()) setProductMeasurementCatalog([])
      return
    }
    // Demo mode has no account to read; the local draft is all there is, so every step
    // counts as loaded.
    if (!isLiveApi()) {
      setLoadedSteps([...ACCOUNT_STEPS])
      return
    }

    // The store starts with the demo catalog. Clear it before a live account can paint,
    // including ready-session mounts, vendor changes, and account reads that later fail.
    setProductMeasurementCatalog([])
    setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [], skuUsage: null })
    const entry = startAccountEntry(access.vendorId, {
      setView: setLoadView,
      setContextError,
      savedSteps: savedStepRef,
    })
    entryRef.current = entry
    return () => {
      entry.cancel()
      if (entryRef.current === entry) entryRef.current = null
    }
  }, [access, setCategoryLimit, setProductLimit, setSkuLimit, setStoreSubmission, setAccountCatalog, setProductMeasurementCatalog, setLoadedSteps])

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
    setMobileView('form')
    formScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    window.setTimeout(() => headingRef.current?.focus(), 0)
  }, [currentStep])

  useEffect(() => {
    if (persistenceStatus !== 'conflict') return
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setBusy(false)
  }, [persistenceStatus])

  const requestConfirmation: RequestConfirmation = (request) => {
    setConfirmState({ ...request, open: true })
  }

  const focusField = (field: string) => {
    window.setTimeout(() => {
      const element = document.getElementById(field)
      if (element instanceof HTMLElement) {
        const disclosure = element.closest('details')
        if (disclosure instanceof HTMLDetailsElement) disclosure.open = true
        if (!element.hasAttribute('tabindex') && !element.matches('input,button,select,textarea,a')) {
          element.setAttribute('tabindex', '-1')
        }
        element.focus()
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      } else headingRef.current?.focus()
    }, 0)
  }

  /**
   * Shows issues and focuses the first. Pass `recheck` only for validation-origin issues:
   * those clear as the vendor fixes them. Server and request failures (OTP, a failed save
   * or go-live, the blocked sample catalog) omit it and stay until the next action.
   */
  const showIssues = (nextIssues: ValidationIssue[], recheck?: IssueRecheck) => {
    setShownIssues({ issues: nextIssues, recheck })
    const first = nextIssues[0]
    setIssueAnnouncement((current) => ({ text: first?.message ?? '', count: current.count + 1 }))
    // Every issue renders inline on its own step. Step 10's readiness check raises issues
    // for Steps 3-9, whose fields are not on screen; Step 10 lists those in its readiness list.
    const onScreen = first?.step === useOnboardingStore.getState().draft.currentStep
    if (first) focusField(onScreen ? first.field : 'readiness-issues')
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
    setStatusMessage('Sending your WhatsApp code…')
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
        { step: 1, field: 'phone', message: getErrorMessage(error, 'Could not send the code. Please try again.') },
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
    setStatusMessage('Verifying your code…')
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
        { step: 2, field: 'otp-0', message: getErrorMessage(error, 'That code is incorrect or has expired.') },
      ])
    } finally {
      finishRequest(controller)
    }
  }

  const resendOtp = async () => {
    if (identitySettled) return false
    const { runtime } = useOnboardingStore.getState()
    if (!runtime.phone) {
      setStatusMessage('Return to the first step and enter the phone number again.')
      return false
    }
    const controller = beginRequest()
    setStatusMessage('Sending a new code…')
    try {
      await authService.requestOtp({ phone: runtime.phone, role: 'vendor' })
      if (requestIsCurrent(controller, 2)) {
        setStatusMessage('We sent a new code to your WhatsApp number.')
        return true
      }
    } catch (error) {
      if (requestIsCurrent(controller, 2)) {
        setStatusMessage(null)
        showIssues([
          { step: 2, field: 'otp-0', message: getErrorMessage(error, 'Could not resend the code. Please try again.') },
        ])
      }
    } finally {
      finishRequest(controller)
    }
    return false
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
        onConfirm: () => void submitStoreForReview(slug),
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
    // Started alongside this step's save, so the next step's account data is usually ready
    // when it opens. A failure is dropped from the cache and the step's own read retries it.
    // Units are left to the step that needs them.
    if (writesReachAccount(draft.catalogSource) && access.state === 'ready') {
      entryRef.current?.prefetchStep((step + 1) as OnboardingStep)
    }
    const fingerprint = stepSaveFingerprint(step, draft, runtime)
    const unchanged = fingerprint !== null && savedStepRef.current[step] === fingerprint
    const shouldPersist =
      writesReachAccount(draft.catalogSource) &&
      isLivePersistedStep(step) &&
      access.state === 'ready' &&
      !unchanged

    if (shouldPersist && access.state === 'ready') {
      const controller = beginRequest()
      const persistenceIsCurrent = () => requestIsCurrent(controller, step)
        && useAuthStore.getState().user?.vendorId === access.vendorId
        && useOnboardingStore.getState().draftOwnerId === access.vendorId
      setStatusMessage('Saving to your store…')
      try {
        // Each write reports what it put on the account, so a step that fails part way
        // still records the part that landed. SKU creates also reread their saved IDs.
        // Submitted stores reach this for categories/products and, once approved, sizes.
        await persistStep(step, access.vendorId, draft, runtime, (assignment) => {
          if (persistenceIsCurrent()) recordAssignment(assignment)
        }, recordCreatedEntry)
        // This step is now on the account, so a cached read from before it is stale. The
        // open wizard keeps what it holds: the draft is now the account copy.
        dropWrittenAccountData(access.vendorId, savedResources(step))
        if (!persistenceIsCurrent()) return
        // Read after the save: minting authored entries rewrites their ids in the draft.
        const latest = useOnboardingStore.getState()
        const saved = stepSaveFingerprint(step, latest.draft, latest.runtime)
        if (saved) for (const sharing of stepsSavedTogether(step)) savedStepRef.current[sharing] = saved
        setStatusMessage(null)
      } catch (error) {
        // Part of the step may have landed, so it no longer matches anything known.
        for (const sharing of stepsSavedTogether(step)) delete savedStepRef.current[sharing]
        if (!persistenceIsCurrent()) return
        setStatusMessage(null)
        // A failed write is never reported as local success.
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
    }

    // `syncedWithAccount` must reflect whether this step actually reached the account.
    // Demo and sample mode skip the write, and claiming otherwise lets the next account
    // read overwrite work the vendor can still see on screen.
    completeStep(step, (step + 1) as OnboardingStep, { syncedWithAccount: shouldPersist || unchanged })
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
      'You will be logged out. Your saved details are safe.',
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
  // Only when this Continue writes to the account. Step 9 saves in Live API whatever the
  // catalog source, and once the store is submitted it is read-only and saves nothing.
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
  // "Review readiness" promises a check that only means something before submission.
  const continueLabel = currentStep === 1 ? 'Send code on WhatsApp'
    : currentStep === 2 ? 'Verify and continue'
      // A submitted store only writes on the additive catalog steps; everywhere else
      // Continue is pure navigation, so the label must not promise a save.
      : storeIsSubmitted ? (isAdditiveCatalogStep(currentStep, storeIsApproved) ? 'Save and continue' : 'Continue')
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
  const stepperProps = { currentStep, completedSteps, furthestVisitedStep, firstNavigableStep, catalogAdditiveOpen: storeIsSubmitted, storeIsApproved }

  // A live, signed-in step from 3 on shows its form only once what it needs has loaded.
  const accountReadsApply = liveApi && access.state === 'ready' && catalogUnlocked && currentStep >= 3
  const stepState = !accountReadsApply ? 'loaded'
    // Every step's reads depend on the context, so none is usable without it.
    : loadView.context === 'failed' ? 'failed'
      // A sample draft has no account copy to wait for.
      : catalogSource !== 'account' ? 'loaded'
        : stepLoadState(currentStep, { submitted: storeIsSubmitted, approved: storeIsApproved, resources: loadView.resources, units: loadView.units })
  const contextPending = liveApi && access.state === 'ready' && (loadView.context === 'idle' || loadView.context === 'loading')
  // An approved store's review step is its status alone: there is nothing left to preview.
  const showPreview = !(currentStep === 10 && storeIsSubmitted && storeIsApproved)
  const formView = showPreview ? mobileView : 'form'

  if (!persistenceInitialized || contextPending) {
    // One gate for both reads. Painting between them shows Step 3 to a vendor whose
    // account puts them on Step 9, and then moves the form under them.
    return (
      <div className="onboarding-shell grid h-full min-h-0 place-items-center text-sm text-[var(--ob-ink-soft)]">
        <span className="flex items-center gap-2">
          <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
          {persistenceInitialized ? 'Restoring your setup…' : 'Restoring browser draft…'}
        </span>
      </div>
    )
  }

  return (
    <div className="onboarding-shell h-full min-h-0 overflow-hidden px-5 text-[var(--ob-ink)] [contain:paint] sm:px-8 xl:px-10">
      {/* A working tool rather than a reading page, so on desktop it sits slightly wider than the
          marketing header's measure. */}
      <div className={cn('ob-grid mx-auto w-full max-w-[81rem]', !showPreview && 'min-[900px]:grid-cols-1')}>
        <div className="flex min-h-0 min-w-0 flex-col">
          {showPreview ? <div className="grid shrink-0 grid-cols-2 gap-1 py-2 min-[900px]:hidden" role="tablist" aria-label="Onboarding view">
            <button id="onboarding-form-tab" type="button" role="tab" tabIndex={mobileView === 'form' ? 0 : -1} aria-controls="onboarding-form-panel" aria-selected={mobileView === 'form'} onClick={() => setMobileView('form')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveMobileTab('preview') } }} className={cn('rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', mobileView === 'form' && 'bg-[var(--ob-sheet)] text-[var(--ob-ink)] shadow-sm')}>Set up</button>
            <button id="onboarding-preview-tab" type="button" role="tab" tabIndex={mobileView === 'preview' ? 0 : -1} aria-controls="onboarding-preview-panel" aria-selected={mobileView === 'preview'} onClick={() => setMobileView('preview')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveMobileTab('form') } }} className={cn('flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', mobileView === 'preview' && 'bg-[var(--ob-sheet)] text-[var(--ob-ink)] shadow-sm')}><EyeIcon className="size-4" /> Your shop</button>
          </div> : null}

          <div className="min-h-0 flex-1">
            <main id="onboarding-form-panel" role={showPreview ? 'tabpanel' : undefined} aria-labelledby={showPreview ? 'onboarding-form-tab' : undefined} className={cn('h-full min-h-0 min-w-0', formView === 'preview' ? 'hidden min-[900px]:block' : 'block')}>
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
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <h1 ref={headingRef} tabIndex={-1} className="font-display text-[1.625rem] leading-[1.15] font-bold tracking-[-0.03em] text-[var(--ob-ink)] outline-none sm:text-[1.875rem]">{stepMeta.title}</h1>
                        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--ob-ink-soft)]">
                          {stepMeta.emphasis
                            ? stepDescription.split(stepMeta.emphasis).flatMap((part, index) => index
                              ? [<strong key={index} className="font-semibold text-[var(--ob-ink)]">{stepMeta.emphasis}</strong>, part]
                              : [part])
                            : stepDescription}
                        </p>
                      </div>
                      {/* The catalog-source toggle and "Start over" both act on the browser
                          draft, and a submitted store is one an administrator holds — neither can
                          touch it, so it is shown neither. "Start over" additionally needs a
                          resolved vendor session to sign out of: the anonymous identity steps have
                          nothing to end, and the dead-end notices below carry their own instead. */}
                      <div className="-mr-1 flex shrink-0 items-center gap-1 pt-1">
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

                      <div role="status" aria-live="polite" className="sr-only">
                        {issues.length && issueAnnouncement.text ? <span key={issueAnnouncement.count}>{issueAnnouncement.text}</span> : null}
                      </div>

                      {/* Keyed on the step so each one arrives rather than swapping in place. */}
                      <div key={currentStep} className="ob-step-enter mt-6">
                        {currentStep === 1 && !identitySettled ? <PhoneStep issues={issues} busy={busy} statusMessage={statusMessage} onContinue={() => void handleContinue()} /> : null}
                        {currentStep === 2 && !identitySettled ? <OtpStep issues={issues} busy={busy} statusMessage={statusMessage} onContinue={() => void handleContinue()} onResend={resendOtp} onChangePhone={changeOtpPhone} /> : null}
                        {catalogUnlocked && storeIsSubmitted && currentStep === 6 && !storeIsApproved ? (
                          <div className="mb-4"><StepNotice tone="info" message="Sizes and prices unlock after approval." /></div>
                        ) : null}
                        {catalogUnlocked && currentStep >= 3 && contextError ? (
                          <div className="mb-4"><StepNotice message={contextError} /></div>
                        ) : null}
                        {!catalogUnlocked && (currentStep >= 3 || identitySettled) ? (
                          <AccessNotice access={access} onSelectVendor={selectVendor} onSignOut={confirmStartOver} />
                        ) : null}
                        {/* A `fieldset` rather than a per-input `disabled` prop: read-only has to
                            hold for every control on the locked steps (3, 7, 8, 9), and threading
                            a flag through those step components is a rule anything new can be added
                            without. Categories/products and approved size additions stay interactive so the catalog
                            can still grow within plan limits; Step 10 is the landing step and stays
                            interactive too. The notices above carry the sign-out action, which
                            stays available because it is the only route backwards. */}
                        <fieldset
                          disabled={submittedStepIsReadOnly(currentStep, storeIsSubmitted, storeIsApproved)}
                          className="min-w-0 border-0 p-0"
                        >
                        {stepState === 'loading' ? <StepSkeleton /> : null}
                        {stepState === 'failed' ? <StepLoadError onRetry={() => entryRef.current?.retry(currentStep)} /> : null}
                        {stepState === 'loaded' ? <>
                          {currentStep === 3 && catalogUnlocked && catalogPolicy.referenceReadsAllowed ? <BusinessStep issues={issues} onUseSample={sampleCatalogFallback} /> : null}
                          {currentStep === 4 && catalogUnlocked && catalogPolicy.referenceReadsAllowed ? <CategoryStep issues={issues} confirm={requestConfirmation} onUseSample={sampleCatalogFallback} /> : null}
                          {currentStep === 5 && catalogUnlocked && catalogPolicy.referenceReadsAllowed ? <ProductStep issues={issues} confirm={requestConfirmation} onUseSample={sampleCatalogFallback} /> : null}
                          {currentStep >= 3 && currentStep <= 5 && catalogUnlocked && !catalogPolicy.referenceReadsAllowed ? (
                            <StepNotice message={currentStep === 3
                              ? 'Demo mode does not load your account catalog. Choose Sample catalog above to continue.'
                              : 'Demo mode cannot load an account-catalog draft. Start over and choose Sample catalog before continuing.'}
                            />
                          ) : null}
                          {currentStep === 6 && catalogUnlocked ? <SkuStep issues={issues} /> : null}
                          {currentStep === 7 && catalogUnlocked ? <DeliveryStep issues={issues} /> : null}
                          {currentStep === 8 && catalogUnlocked ? <PaymentStep issues={issues} /> : null}
                          {currentStep === 9 && catalogUnlocked ? <StorefrontStep issues={issues} /> : null}
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
                      {!(currentStep === 10 && setupNeedsNoFurtherAction) && !(currentStep >= 3 && !catalogUnlocked) && !(currentStep <= 2 && identitySettled) ? <Button className="h-11 px-6 sm:min-w-48" disabled={busy || stepState !== 'loaded'} onClick={() => void handleContinue()}>{busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}{continueLabel}{!busy ? <ArrowRightIcon /> : null}</Button> : null}
                    </div>
                  </div>
                </div> : null}
              </section>
            </main>
            {showPreview ? <PhonePreviewStage id="onboarding-preview-panel" labelledBy="onboarding-preview-tab" className={cn('h-full min-[900px]:hidden', mobileView === 'form' ? 'hidden' : 'flex')} /> : null}
          </div>
        </div>

        {showPreview ? <PhonePreviewStage className="hidden h-full min-[900px]:flex min-[900px]:px-0 min-[900px]:pt-4" /> : null}
      </div>

      <ConfirmDialog {...confirmState} onOpenChange={(open) => setConfirmState((current) => ({ ...current, open }))} />
      <DraftConflictDialog open={persistenceStatus === 'conflict'} onLoad={() => { cancelActiveRequest(); loadNewerDraft() }} onOverwrite={overwriteWithCurrentDraft} />
      <CorruptDraftDialog open={persistenceStatus === 'corrupt'} onReset={clearCorruptDraft} />
    </div>
  )
}
