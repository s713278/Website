import { useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DatabaseIcon,
  EyeIcon,
  LockKeyholeIcon,
  Loader2Icon,
  RotateCcwIcon,
  StoreIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { authService, getErrorMessage, isLiveApi, vendorOnboardingService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components/ui'
import { useOnboardingDraftSession } from '../../hooks/use-onboarding-draft-session'
import { canEnterCatalogSteps, navigationFloor } from '../../lib/onboarding-access'
import {
  buildResumeDraft,
  isStoreSubmitted,
  resumePaymentDetails,
  type ServerOnboardingState,
} from '../../lib/onboarding-resume'
import {
  invalidateVendorOnboardingState,
  loadVendorOnboardingState,
  peekVendorOnboardingState,
} from '../../lib/onboarding-server-state'
import { maskPhone } from '../../lib/onboarding-adapter'
import {
  isLivePersistedStep,
  persistStep,
  stepErrorField,
  writesReachAccount,
} from '../../lib/onboarding-sync'
import { additiveCatalogIssues, normalizeDraftSlug, readinessIssues, validateStep } from '../../lib/onboarding-validation'
import {
  continueWithCatalogPolicy,
  selectCatalogPolicy,
  selectCatalogSource,
  selectCategoryLimit,
  selectStoreIsSubmitted,
  useOnboardingStore,
} from '../../store/onboarding-store'
import {
  ONBOARDING_STEPS,
  isAdditiveCatalogStep,
  type OnboardingStep,
  type ValidationIssue,
} from '../../types/onboarding'
import { AccessNotice, DraftOnlyNotice, StepNotice, UnderReviewNotice } from './AccessNotice'
import { BusinessStep, CategoryStep, ProductStep } from './CatalogSteps'
import { ConfirmDialog, type ConfirmDialogState } from './ConfirmDialog'
import { OtpStep, PhoneStep, VerifiedIdentityNotice } from './IdentitySteps'
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

/**
 * A submitted store is read-only on every step except the additive catalog steps (4-6),
 * which still take additions, and the Step 10 status view. The Continue handler and the
 * `fieldset` guard both read this one predicate so they cannot drift out of lockstep.
 */
function submittedStepIsReadOnly(step: OnboardingStep, submitted: boolean): boolean {
  return submitted && step < 10 && !isAdditiveCatalogStep(step)
}

export function OnboardingWizard() {
  const currentStep = useOnboardingStore((state) => state.draft.currentStep)
  const completedSteps = useOnboardingStore((state) => state.draft.completedSteps)
  const furthestVisitedStep = useOnboardingStore((state) => state.furthestVisitedStep)
  const catalogSource = useOnboardingStore(selectCatalogSource)
  const publicationState = useOnboardingStore((state) => state.draft.publication.state)
  const persistenceInitialized = useOnboardingStore((state) => state.persistenceInitialized)
  const persistenceStatus = useOnboardingStore((state) => state.persistenceStatus)
  const recoveryMessage = useOnboardingStore((state) => state.recoveryMessage)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const completeStep = useOnboardingStore((state) => state.completeStep)
  const goToStep = useOnboardingStore((state) => state.goToStep)
  const completePrototype = useOnboardingStore((state) => state.completePrototype)
  const flushPersistence = useOnboardingStore((state) => state.flushPersistence)
  const loadNewerDraft = useOnboardingStore((state) => state.loadNewerDraft)
  const overwriteWithCurrentDraft = useOnboardingStore((state) => state.overwriteWithCurrentDraft)
  const clearCorruptDraft = useOnboardingStore((state) => state.clearCorruptDraft)
  const categoryLimit = useOnboardingStore(selectCategoryLimit)
  const setCategoryLimit = useOnboardingStore((state) => state.setCategoryLimit)
  const setProductLimit = useOnboardingStore((state) => state.setProductLimit)
  const setSkuLimit = useOnboardingStore((state) => state.setSkuLimit)
  const setStoreSubmission = useOnboardingStore((state) => state.setStoreSubmission)
  const setAccountCatalog = useOnboardingStore((state) => state.setAccountCatalog)
  const setMeasurementCatalog = useOnboardingStore((state) => state.setMeasurementCatalog)
  const setProductMeasurementCatalog = useOnboardingStore((state) => state.setProductMeasurementCatalog)
  const recordAssignment = useOnboardingStore((state) => state.recordAssignment)
  const recordCreatedEntry = useOnboardingStore((state) => state.recordCreatedEntry)
  const applyResumedDraft = useOnboardingStore((state) => state.applyResumedDraft)
  // Read from the account, not the draft: a browser can claim setup needs no more work when
  // nothing ever reached an account. Once true, setup shows what was sent and stops
  // offering controls that cannot reach a store already under review.
  const storeIsSubmitted = useOnboardingStore(selectStoreIsSubmitted)
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

  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  // The wizard must not paint an interactive step before the account has been read:
  // Step 3 would flash and then jump to wherever the resume actually lands.
  const [accountState, setAccountState] = useState<'idle' | 'loading' | 'ready'>('idle')
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
   * this runs on every entry — not once per browser. The one thing it will not do is
   * overwrite edits the vendor has made and not yet saved.
   */
  useLayoutEffect(() => {
    if (access.state !== 'ready') {
      setCategoryLimit(null)
      setProductLimit(null)
      setSkuLimit(null)
      setContextError(null)
      setStoreSubmission(null)
      setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [] })
      if (isLiveApi()) setProductMeasurementCatalog([])
      setAccountState('idle')
      return
    }
    // Demo mode has no account to read; the local draft is all there is.
    if (!isLiveApi()) {
      setAccountState('ready')
      return
    }

    // The store starts with the demo catalog. Clear it before a live account can paint,
    // including ready-session mounts, vendor changes, and account reads that later fail.
    setProductMeasurementCatalog([])

    const apply = (server: ServerOnboardingState) => {
      setContextError(null)
      setCategoryLimit(server.context.subscription.limits.maxCategories)
      setProductLimit(server.context.subscription.limits.maxProducts)
      setSkuLimit(server.context.subscription.limits.maxSkus)
      const accountStoreIsSubmitted = isStoreSubmitted(server)
      // What is already on the store, and therefore counts against every plan limit — and,
      // for categories and products, can no longer be unpicked. `skuIds` is the account's
      // own size identity, needed for the net-zero size rule across draft-clearing paths.
      setAccountCatalog({
        categoryIds: server.categories.map((category) => category.platformCategoryId),
        productIds: server.products.map((product) => product.platformProductId),
        skuIds: server.skus.map((sku) => sku.skuId),
      })
      // Account data, not draft — applied even when local edits win the draft below.
      setMeasurementCatalog(server.measurements)
      setProductMeasurementCatalog(server.productMeasurementCatalog)

      // A submitted store still has to show its own catalog and settings on Steps 3-9,
      // so it is hydrated like any other — it just opens on the review step instead.
      setStoreSubmission(
        accountStoreIsSubmitted
          ? {
              storeIdentifier: server.context.storeIdentifier,
              approvalStatus: server.context.approvalStatus,
              vendorStatus: server.context.vendorStatus,
            }
          : null,
      )

      // Unsaved local work is newest only while setup can still accept it. Once the
      // account says the store was submitted, its snapshot wins: the vendor must land
      // on review and see what was sent, not an un-actionable browser-only draft.
      const current = useOnboardingStore.getState()
      if (current.hasLocalEdits && !accountStoreIsSubmitted) return

      const resumed = buildResumeDraft(server)
      applyResumedDraft(resumed.draft, resumed.furthestVisitedStep, {
        paymentDetails: resumePaymentDetails(server.checkout, current.runtime.paymentDetails),
        orderWhatsapp: resumed.orderWhatsapp,
      })
    }

    // Sign-in resolved this already. Applying it here rather than waiting on the promise
    // keeps the very first paint correct, instead of one frame of the un-hydrated draft.
    const cached = peekVendorOnboardingState(access.vendorId)
    if (cached) {
      apply(cached)
      setAccountState('ready')
      return
    }

    let ignore = false
    setAccountState('loading')

    loadVendorOnboardingState(access.vendorId)
      .then((server) => {
        if (!ignore) apply(server)
      })
      .catch((error: unknown) => {
        if (ignore) return
        // The category limit has a usable fallback, but this same call decides whether a
        // submitted store is shown at all. A vendor whose store is awaiting
        // approval must not be handed an empty wizard with no explanation.
        setContextError(
          getErrorMessage(error, 'Could not load your store details. Some steps may show defaults.'),
        )
      })
      .finally(() => {
        if (!ignore) setAccountState('ready')
      })

    return () => {
      ignore = true
    }
  }, [access, setCategoryLimit, setProductLimit, setSkuLimit, setStoreSubmission, setAccountCatalog, setMeasurementCatalog, setProductMeasurementCatalog, applyResumedDraft])

  useEffect(() => {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setBusy(false)
    setIssues([])
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

  const showIssues = (nextIssues: ValidationIssue[]) => {
    setIssues(nextIssues)
    if (nextIssues[0]) focusField(nextIssues[0].field)
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
    const { draft, runtime } = useOnboardingStore.getState()
    const phoneIssues = validateStep(1, draft, runtime)
    if (phoneIssues.length) {
      showIssues(phoneIssues)
      return
    }
    await sendOtp(runtime.phone)
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
    const { runtime } = useOnboardingStore.getState()
    const otp = runtime.otpDigits.join('')
    if (runtime.otpDigits.some((digit) => !digit)) {
      showIssues([{ step: 2, field: 'otp-0', message: 'Enter all four digits before verifying.' }])
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

  const handleCatalogContinue = async () => {
    const { draft, runtime, measurementCatalog, accountCatalog, productLimit, skuLimit } =
      useOnboardingStore.getState()
    // The projected account total is what every limit gates, so validation is handed the
    // account snapshot and the product/size caps alongside the category cap.
    const enforcement = { maxProducts: productLimit, maxSkus: skuLimit, account: accountCatalog }
    if (draft.currentStep === 10) {
      const nextIssues = readinessIssues(draft, runtime, categoryLimit, measurementCatalog, enforcement)
      if (nextIssues.length) return showIssues(nextIssues)

      const slug = normalizeDraftSlug(draft.storefront.storeName || draft.business.businessName)
      // Sample mode is gated here for the same reason Steps 3-9 gate on it: its IDs are
      // synthetic and nothing behind them was ever written. Without this, activation would
      // submit a real vendor account from a wizard the UI is presenting as sample data.
      if (!writesReachAccount(draft.catalogSource) || access.state !== 'ready') {
        completePrototype(slug)
        return
      }

      const controller = beginRequest()
      setStatusMessage('Submitting your store…')
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
        invalidateVendorOnboardingState(access.vendorId)
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
        // wording sends the vendor back to press Complete setup again on a store that
        // is already submitted.
        if (!requestIsCurrent(controller, 10)) return
        try {
          // Submission activates the vendor but approval is a separate admin step, so the
          // real state is read back rather than assumed.
          const context = await vendorOnboardingService.getVendorContext(access.vendorId)
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
      return
    }
    // A submitted store is read-only except for catalog growth: Steps 4-5 still take
    // additive writes within plan limits, so they fall through to validate + persist. Every
    // other step — including Step 6, whose sizes cannot be created under review — is a pure
    // read-back, so Continue is pure navigation; validating there would report readiness
    // problems on a store that is already with an administrator.
    if (submittedStepIsReadOnly(draft.currentStep, storeIsSubmitted)) {
      navigateToStep((draft.currentStep + 1) as OnboardingStep)
      return
    }

    // A submitted store validates only the additive delta on Steps 4-5 — the plan limit on
    // the categories/products added — never the whole-store readiness rules the vendor
    // cannot act on from here.
    const nextIssues = storeIsSubmitted
      ? additiveCatalogIssues(draft.currentStep, draft, categoryLimit, enforcement)
      : validateStep(draft.currentStep, draft, runtime, categoryLimit, measurementCatalog, enforcement)
    if (nextIssues.length) return showIssues(nextIssues)

    const step = draft.currentStep
    const shouldPersist =
      writesReachAccount(draft.catalogSource) &&
      isLivePersistedStep(step) &&
      access.state === 'ready'

    if (shouldPersist && access.state === 'ready') {
      const controller = beginRequest()
      setStatusMessage('Saving to your store…')
      try {
        // Each write reports what it put on the account, so a step that fails part way
        // still records the part that landed. No re-read: the write is the evidence, and
        // confirming it would add a request to every Continue. A submitted store only ever
        // reaches this for Steps 4-5 (assign-only); Step 6 is read-only under review.
        await persistStep(step, access.vendorId, draft, runtime, recordAssignment, recordCreatedEntry)
        // This step is now on the account, so a cached read from before it is stale.
        invalidateVendorOnboardingState(access.vendorId)
        if (!requestIsCurrent(controller, step)) return
        setStatusMessage(null)
      } catch (error) {
        if (!requestIsCurrent(controller, step)) return
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
    completeStep(step, (step + 1) as OnboardingStep, { syncedWithAccount: shouldPersist })
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
    setIssues([])
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
      'This signs you out and returns you to the first step. Anything already saved to your store stays on your account, and is picked up when you sign in again with this number. '
      + 'Unsaved details in this browser, and any photos you picked, are cleared.',
    confirmLabel: 'Start over',
    tone: 'danger',
    onConfirm: () => {
      cancelActiveRequest()
      void logout()
    },
  })

  const stepMeta = ONBOARDING_STEPS[currentStep - 1]
  // A submitted store needs no further setup whatever the local draft says:
  // `storeSubmission` comes from the account, so "Complete setup" has nothing to do.
  const setupNeedsNoFurtherAction =
    storeIsSubmitted || (publicationState === 'prototype-complete' && completedSteps.includes(10))
  // "Review readiness" promises a check that only means something before submission.
  const continueLabel = currentStep === 1 ? 'Send code on WhatsApp'
    : currentStep === 2 ? 'Verify and continue'
      // A submitted store only writes on the additive catalog steps; everywhere else
      // Continue is pure navigation, so the label must not promise a save.
      : storeIsSubmitted ? (isAdditiveCatalogStep(currentStep) ? 'Save and continue' : 'Continue')
        : currentStep === 9 ? 'Review readiness'
          : currentStep === 10 ? 'Complete setup'
            : 'Continue'
  // In demo mode nothing reaches a vendor account, so say so on every vendor-scoped step
  // rather than only on the ones with an open contract gap.
  //
  // There is deliberately no "your store is further along than this" notice. The only
  // value that could drive one is `onboarding.next_step`, which the backend derives and
  // moves backwards (docs/API_GAPS.md) — it reported steps the vendor had already passed.
  const draftOnlyNotice = currentStep < 3 || liveApi
    ? null
    : 'Demo mode is on, so nothing is sent to a vendor account. Set VITE_USE_API=true to save for real.'
  const sampleCatalogFallback = catalogPolicy.canSwitchTo('sample')
    ? requestSampleCatalog
    : undefined
  const moveMobileTab = (view: 'form' | 'preview') => {
    setMobileView(view)
    window.setTimeout(() => document.getElementById(`onboarding-${view}-tab`)?.focus(), 0)
  }
  const stepperProps = { currentStep, completedSteps, furthestVisitedStep, firstNavigableStep, catalogAdditiveOpen: storeIsSubmitted }

  if (!persistenceInitialized || accountState === 'loading') {
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
    <div className="onboarding-shell h-full min-h-0 overflow-hidden text-[var(--ob-ink)] [contain:paint]">
      <div className="ob-grid">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="grid shrink-0 grid-cols-2 gap-1 p-1.5 min-[900px]:hidden" role="tablist" aria-label="Onboarding view">
            <button id="onboarding-form-tab" type="button" role="tab" tabIndex={mobileView === 'form' ? 0 : -1} aria-controls="onboarding-form-panel" aria-selected={mobileView === 'form'} onClick={() => setMobileView('form')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveMobileTab('preview') } }} className={cn('rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', mobileView === 'form' && 'bg-[var(--ob-sheet)] text-[var(--ob-ink)] shadow-sm')}>Set up</button>
            <button id="onboarding-preview-tab" type="button" role="tab" tabIndex={mobileView === 'preview' ? 0 : -1} aria-controls="onboarding-preview-panel" aria-selected={mobileView === 'preview'} onClick={() => setMobileView('preview')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveMobileTab('form') } }} className={cn('flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', mobileView === 'preview' && 'bg-[var(--ob-sheet)] text-[var(--ob-ink)] shadow-sm')}><EyeIcon className="size-4" /> Your shop</button>
          </div>

          <div className="min-h-0 flex-1">
            <main id="onboarding-form-panel" role="tabpanel" aria-labelledby="onboarding-form-tab" className={cn('h-full min-h-0 min-w-0', mobileView === 'preview' ? 'hidden min-[900px]:block' : 'block')}>
              <section className="flex h-full min-h-0 flex-col">
                <div className="shrink-0">
                  <OnboardingStepper {...stepperProps} onNavigate={navigateToStep} />
                </div>

                <div ref={formScrollRef} id="onboarding-form-scroll" className="@container/onboarding-form min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 [scrollbar-gutter:stable] sm:px-6 min-[900px]:px-8 min-[900px]:pt-5">
                  <div className="mx-auto w-full max-w-[54rem]">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <h1 ref={headingRef} tabIndex={-1} className="font-display text-[1.625rem] leading-[1.15] font-bold tracking-[-0.03em] text-[var(--ob-ink)] outline-none sm:text-[1.875rem]">{stepMeta.title}</h1>
                        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--ob-ink-soft)]">{stepMeta.description}</p>
                      </div>
                      {/* The catalog-source toggle and "Start over" both act on the browser
                          draft, and a submitted store is one an administrator holds — neither can
                          touch it, so it is shown neither. "Start over" additionally needs a
                          resolved vendor session to sign out of: the anonymous identity steps have
                          nothing to end, and the dead-end notices below carry their own instead. */}
                      <div className="flex shrink-0 items-center gap-1 pt-1">
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
                      {recoveryMessage ? <p role="status" className="mt-4 rounded-lg border-l-2 border-l-[var(--ob-brand)] bg-[var(--ob-brand-soft)] px-3 py-2 text-xs leading-5">{recoveryMessage}</p> : null}
                      {persistenceStatus === 'unavailable' ? <p role="status" className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">Browser recovery unavailable. This session continues in memory.</p> : null}

                      {issues.length ? (
                        <div className="mt-5 rounded-xl border-l-2 border-l-destructive bg-destructive/[0.06] p-4" role="alert" aria-labelledby="error-summary-heading">
                          <h2 id="error-summary-heading" className="font-display text-sm font-semibold text-destructive">Please fix {issues.length} item{issues.length === 1 ? '' : 's'}</h2>
                          <ul className="mt-2 space-y-1.5 text-sm">
                            {issues.map((item, index) => <li key={`${item.field}-${index}`}><button type="button" onClick={() => item.step === currentStep ? focusField(item.field) : navigateToStep(item.step)} className="text-left underline decoration-destructive/40 underline-offset-2 hover:text-destructive">{item.message}{item.step !== currentStep ? ` (Step ${item.step})` : ''}</button></li>)}
                          </ul>
                        </div>
                      ) : null}

                      {/* Keyed on the step so each one arrives rather than swapping in place. */}
                      <div key={currentStep} className="ob-step-enter mt-6">
                        {currentStep === 1 && !identitySettled ? <PhoneStep issues={issues} busy={busy} statusMessage={statusMessage} onContinue={() => void handleContinue()} /> : null}
                        {currentStep === 2 && !identitySettled ? <OtpStep issues={issues} busy={busy} statusMessage={statusMessage} onContinue={() => void handleContinue()} onResend={resendOtp} onChangePhone={changeOtpPhone} /> : null}
                        {/* The identity steps are no longer reachable, so the floor states
                            which number this setup belongs to and carries the one way out. */}
                        {catalogUnlocked && identitySettled && currentStep <= firstNavigableStep ? (
                          <div className="mb-4"><VerifiedIdentityNotice /></div>
                        ) : null}
                        {catalogUnlocked && storeIsSubmitted && currentStep >= 3 && currentStep < 10 ? (
                          <div className="mb-4"><UnderReviewNotice variant={isAdditiveCatalogStep(currentStep) ? 'catalog' : currentStep === 6 ? 'sizes' : 'locked'} /></div>
                        ) : null}
                        {catalogUnlocked && draftOnlyNotice ? (
                          <div className="mb-4"><DraftOnlyNotice reason={draftOnlyNotice} /></div>
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
                            without. Steps 4-6 stay interactive on a submitted store so its catalog
                            can still grow within plan limits; Step 10 is the landing step and stays
                            interactive too. The notices above carry the sign-out action, which
                            stays available because it is the only route backwards. */}
                        <fieldset
                          disabled={submittedStepIsReadOnly(currentStep, storeIsSubmitted)}
                          className="min-w-0 border-0 p-0"
                        >
                        {currentStep === 3 && catalogUnlocked ? <BusinessStep issues={issues} confirm={requestConfirmation} onUseSample={sampleCatalogFallback} /> : null}
                        {currentStep === 4 && catalogUnlocked ? <CategoryStep issues={issues} confirm={requestConfirmation} onUseSample={sampleCatalogFallback} /> : null}
                        {currentStep === 5 && catalogUnlocked ? <ProductStep issues={issues} confirm={requestConfirmation} onUseSample={sampleCatalogFallback} /> : null}
                        {currentStep === 6 && catalogUnlocked ? <SkuStep issues={issues} confirm={requestConfirmation} /> : null}
                        {currentStep === 7 && catalogUnlocked ? <DeliveryStep issues={issues} /> : null}
                        {currentStep === 8 && catalogUnlocked ? <PaymentStep issues={issues} /> : null}
                        {currentStep === 9 && catalogUnlocked ? <StorefrontStep issues={issues} /> : null}
                        {currentStep === 10 && catalogUnlocked ? <ReviewStep onGoToStep={navigateToStep} /> : null}
                        </fieldset>
                      </div>
                    </div>
                  </div>
                </div>

                {currentStep >= 3 ? <div className="shrink-0 border-t border-[var(--ob-line)] bg-[var(--ob-canvas-base)]">
                  <div className="mx-auto flex w-full max-w-[54rem] items-center justify-end gap-3 px-4 py-3 sm:px-6 min-[900px]:px-8">
                    <div className="flex items-center gap-2">
                      {currentStep > firstNavigableStep ? <Button variant="ghost" disabled={busy} onClick={goBack}><ArrowLeftIcon /> Back</Button> : null}
                      {!(currentStep === 10 && setupNeedsNoFurtherAction) && !(currentStep >= 3 && !catalogUnlocked) && !(currentStep <= 2 && identitySettled) ? <Button className="h-11 px-6 sm:min-w-48" disabled={busy} onClick={() => void handleContinue()}>{busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}{continueLabel}{!busy ? <ArrowRightIcon /> : null}</Button> : null}
                    </div>
                  </div>
                </div> : null}
              </section>
            </main>
            <PhonePreviewStage id="onboarding-preview-panel" labelledBy="onboarding-preview-tab" className={cn('h-full min-[900px]:hidden', mobileView === 'form' ? 'hidden' : 'flex')} />
          </div>
        </div>

        <PhonePreviewStage className="hidden h-full min-[900px]:flex" />
      </div>

      <ConfirmDialog {...confirmState} onOpenChange={(open) => setConfirmState((current) => ({ ...current, open }))} />
      <DraftConflictDialog open={persistenceStatus === 'conflict'} onLoad={() => { cancelActiveRequest(); loadNewerDraft() }} onOverwrite={overwriteWithCurrentDraft} />
      <CorruptDraftDialog open={persistenceStatus === 'corrupt'} onReset={clearCorruptDraft} />
    </div>
  )
}
