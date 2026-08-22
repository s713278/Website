import { useDeferredValue, useEffect, useRef, useState } from 'react'
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
import {
  authService,
  AuthSessionError,
  getErrorMessage,
  isLiveApi,
  vendorOnboardingService,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components/ui'
import { useOnboardingDraftSession } from '../../hooks/use-onboarding-draft-session'
import { canEnterCatalogSteps } from '../../lib/onboarding-access'
import {
  buildResumeDraft,
  isVendorLive,
  resumePaymentDetails,
  type ServerOnboardingState,
} from '../../lib/onboarding-resume'
import {
  invalidateVendorOnboardingState,
  loadVendorOnboardingState,
  peekVendorOnboardingState,
} from '../../lib/onboarding-server-state'
import { maskPhone } from '../../lib/onboarding-adapter'
import { isLivePersistedStep, persistStep, stepErrorField } from '../../lib/onboarding-sync'
import { normalizeDraftSlug, readinessIssues, validateStep } from '../../lib/onboarding-validation'
import { useOnboardingStore } from '../../store/onboarding-store'
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
  type ValidationIssue,
} from '../../types/onboarding'
import { AccessNotice, DraftOnlyNotice, StepNotice } from './AccessNotice'
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
 * Whether a typed number is provably the one already signed in.
 *
 * `maskedPhone` keeps the last four digits and is deliberately never persisted, so after
 * a reload this returns false and the vendor is asked to confirm. Erring towards showing
 * the warning is the safe direction — the alternative is switching accounts silently.
 */
function matchesSessionPhone(phone: string, maskedPhone: string | null): boolean {
  if (!maskedPhone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 && maskedPhone.endsWith(digits.slice(-4))
}

export function OnboardingWizard() {
  const currentStep = useOnboardingStore((state) => state.draft.currentStep)
  const completedSteps = useOnboardingStore((state) => state.draft.completedSteps)
  const furthestVisitedStep = useOnboardingStore((state) => state.furthestVisitedStep)
  const referenceMode = useOnboardingStore((state) => state.draft.referenceMode)
  const publicationState = useOnboardingStore((state) => state.draft.publication.state)
  const persistenceInitialized = useOnboardingStore((state) => state.persistenceInitialized)
  const persistenceStatus = useOnboardingStore((state) => state.persistenceStatus)
  const recoveryMessage = useOnboardingStore((state) => state.recoveryMessage)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const completeStep = useOnboardingStore((state) => state.completeStep)
  const goToStep = useOnboardingStore((state) => state.goToStep)
  const completePrototype = useOnboardingStore((state) => state.completePrototype)
  const reset = useOnboardingStore((state) => state.reset)
  const flushPersistence = useOnboardingStore((state) => state.flushPersistence)
  const loadNewerDraft = useOnboardingStore((state) => state.loadNewerDraft)
  const overwriteWithCurrentDraft = useOnboardingStore((state) => state.overwriteWithCurrentDraft)
  const clearCorruptDraft = useOnboardingStore((state) => state.clearCorruptDraft)
  const categoryLimit = useOnboardingStore((state) => state.categoryLimit)
  const setCategoryLimit = useOnboardingStore((state) => state.setCategoryLimit)
  const setLivePublication = useOnboardingStore((state) => state.setLivePublication)
  const setAccountCatalog = useOnboardingStore((state) => state.setAccountCatalog)
  const applyResumedDraft = useOnboardingStore((state) => state.applyResumedDraft)
  const livePublication = useOnboardingStore((state) => state.livePublication)
  const adoptVerifiedSession = useOnboardingStore((state) => state.adoptVerifiedSession)
  const revokeVerifiedSession = useOnboardingStore((state) => state.revokeVerifiedSession)

  const completeOtpLogin = useAuthStore((state) => state.completeOtpLogin)
  const clearSession = useAuthStore((state) => state.clearSession)
  const selectVendor = useAuthStore((state) => state.selectVendor)
  const logout = useAuthStore((state) => state.logout)
  const { access, hasSession } = useOnboardingDraftSession()
  const catalogUnlocked = canEnterCatalogSteps(access)

  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  // The wizard must not paint an interactive step before the account has been read:
  // Step 3 would flash and then jump to wherever the resume actually lands.
  const [accountState, setAccountState] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [contextError, setContextError] = useState<string | null>(null)
  const [vendorIsLive, setVendorIsLive] = useState(false)
  // A vendor may change their number until their store goes live. Re-running OTP still
  // signs a different vendor in underneath this draft, so it is a confirmed switch
  // rather than something that can happen by accident. Once the store is live the
  // identity is settled: changing it would mean a second store, not an edit.
  const identitySettled = hasSession && vendorIsLive
  const firstNavigableStep: OnboardingStep = identitySettled ? 3 : 1
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
  useEffect(() => {
    if (access.state !== 'ready') {
      setCategoryLimit(null)
      setContextError(null)
      setVendorIsLive(false)
      setLivePublication(null)
      setAccountCatalog({ categoryIds: [], productIds: [] })
      setAccountState('idle')
      return
    }
    // Demo mode has no account to read; the local draft is all there is.
    if (!isLiveApi()) {
      setAccountState('ready')
      return
    }

    const apply = (server: ServerOnboardingState) => {
      setContextError(null)
      setCategoryLimit(server.context.subscription.limits.maxCategories)
      setVendorIsLive(isVendorLive(server))
      // What is already on the store, and therefore can no longer be unpicked.
      setAccountCatalog({
        categoryIds: server.categories.map((category) => category.platformCategoryId),
        productIds: server.products.map((product) => product.platformProductId),
      })

      // A submitted store still has to show its own catalog and settings on Steps 3-9,
      // so it is hydrated like any other — it just opens on the review step instead.
      setLivePublication(
        isVendorLive(server)
          ? {
              storeIdentifier: server.context.storeIdentifier,
              approvalStatus: server.context.approvalStatus,
              vendorStatus: server.context.vendorStatus,
            }
          : null,
      )

      // Unsaved local work is the vendor's newest and outranks the account copy.
      const current = useOnboardingStore.getState()
      if (current.hasLocalEdits) return

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
        // finished store is shown at all. A vendor whose store is live and awaiting
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
  }, [access, setCategoryLimit, setLivePublication, setAccountCatalog, applyResumedDraft])

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
    if (referenceMode === 'sample') return
    requestConfirmation({
      title: 'Switch the whole catalog to sample data?',
      description: 'This clears the current business type, categories, products, and their sizes and prices, because sample and live IDs cannot be mixed.',
      confirmLabel: 'Use sample catalog',
      tone: 'danger',
      onConfirm: () => {
        cancelActiveRequest()
        updateDraft((current) => ({
          ...current,
          referenceMode: 'sample',
          business: { ...current.business, businessType: null },
          categories: [],
          products: [],
          skus: [],
        }), 3)
      },
    })
  }

  const requestLiveCatalog = () => {
    if (referenceMode === 'live') return
    requestConfirmation({
      title: 'Return to the live catalog?',
      description: 'Sample selections will be cleared before live data loads because their IDs are not compatible.',
      confirmLabel: 'Return to live catalog',
      tone: 'danger',
      onConfirm: () => {
        cancelActiveRequest()
        updateDraft((current) => ({
          ...current,
          referenceMode: 'live',
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
    if (identitySettled) return
    const { draft, runtime } = useOnboardingStore.getState()
    const phoneIssues = validateStep(1, draft, runtime)
    if (phoneIssues.length) {
      showIssues(phoneIssues)
      return
    }
    const phone = runtime.phone

    // `request-otp` is what creates the account, so the warning belongs here rather
    // than before verification. Skipped only when the number is provably the one
    // already signed in.
    if (hasSession && !matchesSessionPhone(phone, draft.maskedPhone)) {
      confirmNumberChange(phone)
      return
    }

    await sendOtp(phone)
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

  const confirmNumberChange = (phone: string) => requestConfirmation({
    title: 'Set up with a different number?',
    description:
      'This signs you out of the number you are using now and starts setup on the new one, creating a new store if that number has never been used. '
      + 'Anything already saved to your current store stays with it — sign in with that number again to pick it up. '
      + 'Unsaved details in this browser, and any photos you picked, are cleared.',
    confirmLabel: 'Use this number',
    tone: 'danger',
    onConfirm: () => {
      void sendOtp(phone)
    },
  })

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
      // An AuthSessionError means the backend verified the number but the app refused the
      // session, and `verifyOtp` has already dropped the tokens on the way out. The Zustand
      // session has to go too, or the wizard keeps showing the previous vendor as signed in
      // with no credentials behind them until some later request happens to 401.
      if (error instanceof AuthSessionError) clearSession()
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

  const handleContinue = async () => {
    const { draft, runtime } = useOnboardingStore.getState()
    setStatusMessage(null)
    if (draft.currentStep === 1) return handleOtpRequest()
    if (draft.currentStep === 2) return handleOtpVerify()
    if (!catalogUnlocked) return
    if (draft.currentStep === 10) {
      const nextIssues = readinessIssues(draft, runtime, categoryLimit)
      if (nextIssues.length) return showIssues(nextIssues)

      const slug = normalizeDraftSlug(draft.storefront.storeName || draft.business.businessName)
      // Sample mode is gated here for the same reason Steps 3-9 gate on it: its IDs are
      // synthetic and nothing behind them was ever written. Without this, go-live would
      // submit a real vendor account from a wizard the UI is presenting as sample data.
      if (!isLiveApi() || access.state !== 'ready' || draft.referenceMode !== 'live') {
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

        // Past this point the store is submitted. The read-back only refines what is
        // shown, so its failure must never be reported as a failed submission — that
        // wording sends the vendor back to press Complete setup again on a store that
        // is already live.
        //
        // The account just changed: anything cached from before go-live is now stale.
        invalidateVendorOnboardingState(access.vendorId)
        try {
          // Go-live activates the vendor but approval is a separate admin step, so the
          // real state is read back rather than assumed.
          const context = await vendorOnboardingService.getVendorContext(access.vendorId)
          if (!requestIsCurrent(controller, 10)) return
          setLivePublication({
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
    const nextIssues = validateStep(draft.currentStep, draft, runtime, categoryLimit)
    if (nextIssues.length) return showIssues(nextIssues)

    const step = draft.currentStep
    // Demo mode has no backend, and sample data carries synthetic IDs. Neither is
    // ever written to a real account.
    const shouldPersist =
      isLiveApi() &&
      isLivePersistedStep(step) &&
      access.state === 'ready' &&
      draft.referenceMode === 'live'

    if (shouldPersist && access.state === 'ready') {
      const controller = beginRequest()
      setStatusMessage('Saving to your store…')
      try {
        await persistStep(step, access.vendorId, draft, runtime)
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

  const navigateToStep = (step: OnboardingStep) => {
    cancelActiveRequest()
    if (identitySettled) {
      goToStep(Math.max(step, firstNavigableStep) as OnboardingStep)
      return
    }
    goToStep(step <= 2 && !useOnboardingStore.getState().runtime.phone ? 1 : step)
  }

  const goBack = () => {
    if (currentStep > firstNavigableStep) navigateToStep((currentStep - 1) as OnboardingStep)
  }

  const confirmReset = () => requestConfirmation({
    title: 'Start onboarding over?',
    description: 'This removes the saved onboarding draft and local image previews. Other app and authentication data are untouched.',
    confirmLabel: 'Start over',
    tone: 'danger',
    onConfirm: () => {
      cancelActiveRequest()
      reset()
      setIssues([])
    },
  })

  const stepMeta = ONBOARDING_STEPS[currentStep - 1]
  // A submitted store is finished whatever the local draft says: `livePublication` comes
  // from the account, and there is nothing left for "Complete setup" to do.
  const isComplete =
    livePublication != null || (publicationState === 'prototype-complete' && completedSteps.includes(10))
  const continueLabel = currentStep === 1 ? 'Send code on WhatsApp'
    : currentStep === 2 ? 'Verify and continue'
      : currentStep === 9 ? 'Review readiness'
        : currentStep === 10 ? 'Complete setup'
          : 'Continue'
  // In demo mode nothing reaches a vendor account, so say so on every vendor-scoped step
  // rather than only on the ones with an open contract gap.
  //
  // There is deliberately no "your store is further along than this" notice. The only
  // value that could drive one is `onboarding.next_step`, which the backend derives and
  // moves backwards (docs/API_GAPS.md) — it reported steps the vendor had already passed.
  const draftOnlyNotice = currentStep < 3 || isLiveApi()
    ? null
    : 'Demo mode is on, so nothing is sent to a vendor account. Set VITE_USE_API=true to save for real.'
  const moveMobileTab = (view: 'form' | 'preview') => {
    setMobileView(view)
    window.setTimeout(() => document.getElementById(`onboarding-${view}-tab`)?.focus(), 0)
  }
  const stepperProps = { currentStep, completedSteps, furthestVisitedStep, firstNavigableStep }

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
                      <div className="flex shrink-0 items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={referenceMode === 'live' ? requestSampleCatalog : requestLiveCatalog}
                          aria-label={`${referenceMode === 'live' ? 'Live' : 'Sample'} catalog. Change catalog mode.`}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]',
                            referenceMode === 'live'
                              ? 'text-[var(--ob-ink-soft)] hover:bg-[var(--ob-sheet)] hover:text-[var(--ob-ink)]'
                              : 'bg-amber-100 text-amber-900 hover:bg-amber-200/80 dark:bg-amber-950/45 dark:text-amber-200',
                          )}
                        >
                          <DatabaseIcon className="size-3.5" aria-hidden="true" />
                          <span className="sm:hidden">{referenceMode === 'live' ? 'Live' : 'Sample'}</span>
                          <span className="hidden sm:inline">{referenceMode === 'live' ? 'Live catalog' : 'Sample catalog'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={confirmReset}
                          aria-label="Start over"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-[var(--ob-ink-soft)] outline-none transition-colors hover:bg-[var(--ob-sheet)] hover:text-[var(--ob-ink)] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]"
                        >
                          <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                          <span className="hidden min-[700px]:inline">Start over</span>
                        </button>
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
                        {currentStep <= 2 && identitySettled ? (
                          catalogUnlocked
                            ? <VerifiedIdentityNotice onSignOut={() => void logout()} />
                            : <AccessNotice access={access} onSelectVendor={selectVendor} onSignOut={() => void logout()} />
                        ) : null}
                        {currentStep === 1 && !identitySettled ? <PhoneStep issues={issues} busy={busy} statusMessage={statusMessage} /> : null}
                        {currentStep === 2 && !identitySettled ? <OtpStep issues={issues} busy={busy} statusMessage={statusMessage} onResend={resendOtp} /> : null}
                        {catalogUnlocked && draftOnlyNotice ? (
                          <div className="mb-4"><DraftOnlyNotice reason={draftOnlyNotice} /></div>
                        ) : null}
                        {catalogUnlocked && currentStep >= 3 && contextError ? (
                          <div className="mb-4"><StepNotice message={contextError} /></div>
                        ) : null}
                        {currentStep >= 3 && !catalogUnlocked ? (
                          <AccessNotice access={access} onSelectVendor={selectVendor} onSignOut={() => void logout()} />
                        ) : null}
                        {currentStep === 3 && catalogUnlocked ? <BusinessStep issues={issues} confirm={requestConfirmation} onUseSample={requestSampleCatalog} /> : null}
                        {currentStep === 4 && catalogUnlocked ? <CategoryStep issues={issues} confirm={requestConfirmation} onUseSample={requestSampleCatalog} /> : null}
                        {currentStep === 5 && catalogUnlocked ? <ProductStep issues={issues} confirm={requestConfirmation} onUseSample={requestSampleCatalog} /> : null}
                        {currentStep === 6 && catalogUnlocked ? <SkuStep issues={issues} confirm={requestConfirmation} /> : null}
                        {currentStep === 7 && catalogUnlocked ? <DeliveryStep issues={issues} /> : null}
                        {currentStep === 8 && catalogUnlocked ? <PaymentStep issues={issues} /> : null}
                        {currentStep === 9 && catalogUnlocked ? <StorefrontStep issues={issues} /> : null}
                        {currentStep === 10 && catalogUnlocked ? <ReviewStep onGoToStep={navigateToStep} /> : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-[var(--ob-line)] bg-[var(--ob-canvas-base)]">
                  <div className="mx-auto flex w-full max-w-[54rem] items-center justify-end gap-3 px-4 py-3 sm:px-6 min-[900px]:px-8">
                    <div className="flex items-center gap-2">
                      {currentStep > firstNavigableStep ? <Button variant="ghost" disabled={busy} onClick={goBack}><ArrowLeftIcon /> Back</Button> : null}
                      {!(currentStep === 10 && isComplete) && !(currentStep >= 3 && !catalogUnlocked) && !(currentStep <= 2 && identitySettled) ? <Button className="h-11 px-6 sm:min-w-48" disabled={busy} onClick={() => void handleContinue()}>{busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}{continueLabel}{!busy ? <ArrowRightIcon /> : null}</Button> : null}
                    </div>
                  </div>
                </div>
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
