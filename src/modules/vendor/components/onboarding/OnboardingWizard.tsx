import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  DatabaseIcon,
  EyeIcon,
  LockKeyholeIcon,
  Loader2Icon,
  RotateCcwIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { authService, getErrorMessage, isLiveApi, vendorOnboardingService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components/ui'
import { canEnterCatalogSteps, resolveOnboardingAccess } from '../../lib/onboarding-access'
import { maskPhone } from '../../lib/onboarding-adapter'
import { draftOnlyReason, isLivePersistedStep, persistStep, stepErrorField } from '../../lib/onboarding-sync'
import { normalizeDraftSlug, readinessIssues, validateStep } from '../../lib/onboarding-validation'
import { useOnboardingStore } from '../../store/onboarding-store'
import {
  ONBOARDING_STEPS,
  type OnboardingPersistenceStatus,
  type OnboardingStep,
  type ValidationIssue,
} from '../../types/onboarding'
import { AccessNotice, DraftOnlyNotice } from './AccessNotice'
import { BusinessStep, CategoryStep, ProductStep } from './CatalogSteps'
import { ConfirmDialog, type ConfirmDialogState } from './ConfirmDialog'
import { OtpStep, PhoneStep } from './IdentitySteps'
import { DeliveryStep, PaymentStep, SkuStep } from './OperationsSteps'
import { CorruptDraftDialog, DraftConflictDialog } from './RecoveryDialogs'
import { ReviewStep, StorefrontStep } from './StoreSteps'
import { StorefrontPreview } from './StorefrontPreview'
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

function PhonePreviewStage({ className, id, labelledBy }: { className?: string; id?: string; labelledBy?: string }) {
  return (
    <aside id={id} role={labelledBy ? 'tabpanel' : undefined} aria-labelledby={labelledBy} className={cn('onboarding-preview-stage relative min-h-0 overflow-hidden bg-muted/35', className)} aria-label={labelledBy ? undefined : 'Storefront preview'}>
      <div className="onboarding-phone-frame">
        <LivePreviewPane />
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><LockKeyholeIcon className="size-3" aria-hidden="true" />Private preview</span>
    </aside>
  )
}

function persistenceLabel(status: OnboardingPersistenceStatus): string {
  if (status === 'loading') return 'Checking saved draft'
  if (status === 'saving') return 'Saving…'
  if (status === 'saved') return 'Saved in this browser'
  if (status === 'unavailable') return 'Browser recovery unavailable'
  if (status === 'conflict') return 'Saving paused'
  if (status === 'corrupt') return 'Saved draft needs reset'
  return 'Browser draft ready'
}

function PersistenceStatus({ status, label }: { status: OnboardingPersistenceStatus; label: string }) {
  const pending = status === 'loading' || status === 'saving'
  const saved = status === 'saved'
  const unavailable = status === 'unavailable' || status === 'corrupt' || status === 'conflict'

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground',
        unavailable && 'text-amber-700 dark:text-amber-300',
      )}
    >
      {pending ? (
        <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : saved ? (
        <CheckIcon className="size-3.5 text-primary" aria-hidden="true" />
      ) : (
        <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
      )}
      <span className="hidden max-w-40 truncate min-[560px]:inline">{label}</span>
    </span>
  )
}

function StepJourney({
  currentStep,
  completedSteps,
  furthestVisitedStep,
  onNavigate,
}: {
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  furthestVisitedStep: OnboardingStep
  onNavigate: (step: OnboardingStep) => void
}) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="isolate grid grid-cols-10">
        {ONBOARDING_STEPS.map((item, index) => {
          const completed = completedSteps.includes(item.step)
          const current = currentStep === item.step
          const reachable = item.step <= furthestVisitedStep
          const previousStep = ONBOARDING_STEPS[index - 1]
          const connectorComplete = previousStep ? completedSteps.includes(previousStep.step) : false
          const stateLabel = current ? 'Current step' : completed ? 'Completed' : reachable ? 'Available' : 'Locked'

          return (
            <li key={item.step} className="relative min-w-0">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-3 right-1/2 -left-1/2 z-0 h-0.5 bg-border/70 transition-colors min-[400px]:top-3.5',
                    connectorComplete && 'bg-primary/60',
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
                aria-label={`${item.short}. ${stateLabel}.`}
                title={`${item.short}: ${stateLabel.toLowerCase()}`}
                onClick={() => onNavigate(item.step)}
                className={cn(
                  'group relative z-10 flex min-h-10 w-full min-w-0 flex-col items-center gap-1.5 rounded-md px-0.5 outline-none',
                  !reachable && 'cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full border bg-background text-[9px] font-bold tabular-nums text-muted-foreground transition-[background-color,border-color,color,box-shadow] group-focus-visible:ring-2 group-focus-visible:ring-primary/20 min-[400px]:size-7 min-[400px]:text-[10px] sm:group-focus-visible:ring-4',
                    completed && !current && 'border-primary bg-primary text-primary-foreground group-hover:bg-primary/90',
                    current && 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/12 sm:ring-4',
                    reachable && !current && !completed && 'border-primary/35 bg-primary/[0.07] text-primary group-hover:border-primary/55 group-hover:bg-primary/10',
                    !reachable && 'border-border/70 bg-muted/70 text-muted-foreground/45',
                  )}
                  aria-hidden="true"
                >
                  {completed && !current ? <CheckIcon className="size-3.5 stroke-[2.5]" /> : item.step}
                </span>
                <span
                  className={cn(
                    'hidden max-w-full truncate text-[10px] font-medium leading-none text-muted-foreground min-[1160px]:block',
                    current && 'font-semibold text-primary',
                    completed && !current && 'text-foreground/75',
                    !reachable && 'opacity-45',
                  )}
                  aria-hidden="true"
                >
                  {item.short}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
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
  const initializePersistence = useOnboardingStore((state) => state.initializePersistence)
  const flushPersistence = useOnboardingStore((state) => state.flushPersistence)
  const loadNewerDraft = useOnboardingStore((state) => state.loadNewerDraft)
  const overwriteWithCurrentDraft = useOnboardingStore((state) => state.overwriteWithCurrentDraft)
  const clearCorruptDraft = useOnboardingStore((state) => state.clearCorruptDraft)
  const categoryLimit = useOnboardingStore((state) => state.categoryLimit)
  const setCategoryLimit = useOnboardingStore((state) => state.setCategoryLimit)
  const adoptVerifiedSession = useOnboardingStore((state) => state.adoptVerifiedSession)
  const revokeVerifiedSession = useOnboardingStore((state) => state.revokeVerifiedSession)

  const user = useAuthStore((state) => state.user)
  const completeOtpLogin = useAuthStore((state) => state.completeOtpLogin)
  const selectVendor = useAuthStore((state) => state.selectVendor)
  const logout = useAuthStore((state) => state.logout)
  const access = useMemo(() => resolveOnboardingAccess(user), [user])
  const catalogUnlocked = canEnterCatalogSteps(access)

  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
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
    initializePersistence()
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
    }
  }, [flushPersistence, initializePersistence])

  // Steps 1-2 exist to establish a session. If one already exists (for example the vendor
  // signed in at /vendor/login first) they are already satisfied; if it disappears, the
  // draft must not keep claiming a verified number.
  useEffect(() => {
    if (!persistenceInitialized) return
    if (access.state === 'anonymous') revokeVerifiedSession()
    else adoptVerifiedSession(null)
  }, [access.state, persistenceInitialized, adoptVerifiedSession, revokeVerifiedSession])

  useEffect(() => {
    if (access.state !== 'ready') {
      setCategoryLimit(null)
      return
    }
    const controller = new AbortController()
    let ignore = false
    vendorOnboardingService
      .getVendorContext(access.vendorId, { signal: controller.signal })
      .then((context) => {
        if (!ignore) setCategoryLimit(context.subscription.limits.maxCategories)
      })
      .catch(() => {
        // Limits are an enhancement; the configured fallback keeps the step usable.
      })
    return () => {
      ignore = true
      controller.abort()
    }
  }, [access, setCategoryLimit])

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
      description: 'This clears the current business type, categories, products, and SKUs because sample and live IDs cannot be mixed.',
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
    const { draft, runtime } = useOnboardingStore.getState()
    const phoneIssues = validateStep(1, draft, runtime)
    if (phoneIssues.length) {
      showIssues(phoneIssues)
      return
    }
    const phone = runtime.phone
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
      const nextIssues = readinessIssues(draft, runtime)
      if (nextIssues.length) return showIssues(nextIssues)
      completePrototype(normalizeDraftSlug(draft.storefront.storeName || draft.business.businessName))
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

    completeStep(step, (step + 1) as OnboardingStep)
  }

  const navigateToStep = (step: OnboardingStep) => {
    cancelActiveRequest()
    const target = step <= 2 && !useOnboardingStore.getState().runtime.phone ? 1 : step
    goToStep(target)
  }

  const goBack = () => {
    if (currentStep > 1) navigateToStep((currentStep - 1) as OnboardingStep)
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
  const isComplete = publicationState === 'prototype-complete' && completedSteps.includes(10)
  const continueLabel = currentStep === 1 ? 'Send code on WhatsApp'
    : currentStep === 2 ? 'Verify and continue'
      : currentStep === 9 ? 'Review readiness'
        : currentStep === 10 ? 'Complete setup'
          : 'Continue'
  const saveLabel = persistenceLabel(persistenceStatus)
  // In demo mode nothing reaches a vendor account, so say so on every vendor-scoped step
  // rather than only on the ones with an open contract gap.
  const stepNotice = currentStep >= 3
    ? (!isLiveApi()
        ? 'Demo mode is on, so nothing is sent to a vendor account. Set VITE_USE_API=true to save for real.'
        : draftOnlyReason(currentStep))
    : null
  const moveMobileTab = (view: 'form' | 'preview') => {
    setMobileView(view)
    window.setTimeout(() => document.getElementById(`onboarding-${view}-tab`)?.focus(), 0)
  }

  if (!persistenceInitialized) {
    return (
      <div className="grid h-full min-h-0 place-items-center bg-background text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" /> Restoring browser draft…</span>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-hidden bg-background text-foreground [contain:paint]">
      <div className="grid h-full min-h-0 min-[900px]:grid-cols-[minmax(0,1fr)_clamp(17rem,22vw,19rem)]">
        <div className="flex min-h-0 min-w-0 flex-col bg-background">
          <div className="grid shrink-0 grid-cols-2 border-b border-border/45 bg-background p-1 min-[900px]:hidden" role="tablist" aria-label="Onboarding view">
            <button id="onboarding-form-tab" type="button" role="tab" tabIndex={mobileView === 'form' ? 0 : -1} aria-controls="onboarding-form-panel" aria-selected={mobileView === 'form'} onClick={() => setMobileView('form')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveMobileTab('preview') } }} className={cn('rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-primary/25', mobileView === 'form' && 'bg-muted/70 text-foreground')}>Form</button>
            <button id="onboarding-preview-tab" type="button" role="tab" tabIndex={mobileView === 'preview' ? 0 : -1} aria-controls="onboarding-preview-panel" aria-selected={mobileView === 'preview'} onClick={() => setMobileView('preview')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveMobileTab('form') } }} className={cn('flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-primary/25', mobileView === 'preview' && 'bg-muted/70 text-foreground')}><EyeIcon className="size-4" /> Preview</button>
          </div>

          <div className="min-h-0 flex-1">
            <main id="onboarding-form-panel" role="tabpanel" aria-labelledby="onboarding-form-tab" className={cn('h-full min-h-0 min-w-0', mobileView === 'preview' ? 'hidden min-[900px]:block' : 'block')}>
              <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
                <div className="shrink-0 border-b border-border/45">
                  <div className="mx-auto w-full max-w-[52rem] px-5 pt-3.5 pb-4 sm:px-7 min-[900px]:px-8 min-[900px]:pt-4">
                    <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3">
                      <PersistenceStatus status={persistenceStatus} label={saveLabel} />
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={referenceMode === 'live' ? requestSampleCatalog : requestLiveCatalog}
                          aria-label={`${referenceMode === 'live' ? 'Live' : 'Sample'} catalog. Change catalog mode.`}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-primary/25',
                            referenceMode === 'live'
                              ? 'bg-primary/[0.08] text-primary hover:bg-primary/[0.12]'
                              : 'bg-amber-100 text-amber-900 hover:bg-amber-200/80 dark:bg-amber-950/45 dark:text-amber-200',
                          )}
                        >
                          <DatabaseIcon className="size-3.5" aria-hidden="true" />
                          <span className="sm:hidden">{referenceMode === 'live' ? 'Live' : 'Sample'}</span>
                          <span className="hidden sm:inline">{referenceMode === 'live' ? 'Live catalog' : 'Sample catalog'}</span>
                        </button>
                        <Button variant="ghost" size="sm" aria-label="Start over" className="px-2" onClick={confirmReset}>
                          <RotateCcwIcon />
                          <span className="hidden min-[700px]:inline">Start over</span>
                        </Button>
                      </div>
                    </div>
                    <StepJourney currentStep={currentStep} completedSteps={completedSteps} furthestVisitedStep={furthestVisitedStep} onNavigate={navigateToStep} />
                    <div className="mt-2.5">
                      <h1 ref={headingRef} tabIndex={-1} className="font-display text-[1.45rem] font-semibold tracking-[-0.025em] outline-none sm:text-[1.625rem]">{stepMeta.title}</h1>
                      <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{stepMeta.description}</p>
                    </div>
                    {recoveryMessage ? <p role="status" className="mt-2.5 rounded-lg bg-primary/[0.07] px-3 py-2 text-xs leading-5 text-foreground">{recoveryMessage}</p> : null}
                    {persistenceStatus === 'unavailable' ? <p role="status" className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">Browser recovery unavailable. This session continues in memory.</p> : null}
                  </div>
                </div>

                <div ref={formScrollRef} id="onboarding-form-scroll" className="@container/onboarding-form min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                  <div className="mx-auto w-full max-w-[52rem]">
                    {issues.length ? (
                      <div className="mx-5 mt-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4 sm:mx-7 min-[900px]:mx-8" role="alert" aria-labelledby="error-summary-heading">
                        <h2 id="error-summary-heading" className="font-display text-sm font-semibold text-destructive">Please fix {issues.length} item{issues.length === 1 ? '' : 's'}</h2>
                        <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">
                          {issues.map((item, index) => <li key={`${item.field}-${index}`}><button type="button" onClick={() => item.step === currentStep ? focusField(item.field) : navigateToStep(item.step)} className="text-left underline decoration-destructive/40 underline-offset-2 hover:text-foreground">{item.message}{item.step !== currentStep ? ` (Step ${item.step})` : ''}</button></li>)}
                        </ul>
                      </div>
                    ) : null}

                    <div className="px-5 pt-4 pb-6 sm:px-7 min-[900px]:px-8 min-[900px]:pb-8">
                      {currentStep === 1 ? <PhoneStep issues={issues} busy={busy} statusMessage={statusMessage} /> : null}
                      {currentStep === 2 ? <OtpStep issues={issues} busy={busy} statusMessage={statusMessage} onResend={resendOtp} /> : null}
                      {catalogUnlocked && stepNotice ? (
                        <div className="mb-4"><DraftOnlyNotice reason={stepNotice} /></div>
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

                <div className="shrink-0 border-t border-border/45 bg-background">
                  <div className={cn('mx-auto flex w-full max-w-[52rem] flex-wrap items-center gap-3 px-5 py-3 sm:px-7 min-[900px]:px-8', currentStep === 1 ? 'justify-end' : 'justify-between')}>
                    {currentStep > 1 ? <Button variant="ghost" disabled={busy} onClick={goBack}><ArrowLeftIcon /> Back</Button> : null}
                    {!(currentStep === 10 && isComplete) && !(currentStep >= 3 && !catalogUnlocked) ? <Button className="sm:min-w-44" disabled={busy} onClick={() => void handleContinue()}>{busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}{continueLabel}{!busy ? <ArrowRightIcon /> : null}</Button> : null}
                  </div>
                </div>
              </section>
            </main>
            <PhonePreviewStage id="onboarding-preview-panel" labelledBy="onboarding-preview-tab" className={cn('h-full min-[900px]:hidden', mobileView === 'form' ? 'hidden' : 'flex')} />
          </div>
        </div>

        <PhonePreviewStage className="hidden h-full border-l border-border/55 min-[900px]:flex" />
      </div>

      <ConfirmDialog {...confirmState} onOpenChange={(open) => setConfirmState((current) => ({ ...current, open }))} />
      <DraftConflictDialog open={persistenceStatus === 'conflict'} onLoad={() => { cancelActiveRequest(); loadNewerDraft() }} onOverwrite={overwriteWithCurrentDraft} />
      <CorruptDraftDialog open={persistenceStatus === 'corrupt'} onReset={clearCorruptDraft} />
    </div>
  )
}
