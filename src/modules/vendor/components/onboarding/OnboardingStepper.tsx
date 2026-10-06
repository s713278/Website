import { useEffect, useRef, useState } from 'react'
import { CheckIcon, LockKeyholeIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS, isAdditiveCatalogStep, type OnboardingStep } from '../../types/onboarding'

type StepState = 'settled' | 'done' | 'current' | 'open' | 'locked'

const STATE_LABEL: Record<StepState, string> = {
  settled: 'Verified, so this step is behind you',
  done: 'Done',
  current: 'You are here',
  open: 'Ready when you are',
  locked: 'Comes later',
}

export type StepperProps = {
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  furthestVisitedStep: OnboardingStep
  /** The lowest step navigation may reach. Steps below it are settled and not offered. */
  firstNavigableStep: OnboardingStep
  /**
   * A submitted store can still grow its catalog on Steps 4-6. When true, those steps
   * carry an "open for additions" marker so the one place still actionable stays visible
   * from the progress bar, not only from inside the step.
   */
  catalogAdditiveOpen?: boolean
  storeIsApproved?: boolean
  onNavigate: (step: OnboardingStep) => void
}

/**
 * The ten steps, across the top.
 *
 * Every step stays on screen and keeps its name: the old version dropped its labels
 * below 1160px, which left ten identical dots and no way to tell where you were. Here a
 * narrow window scrolls the row instead, and the current step is scrolled into view, so
 * the labels never have to be traded away for the width.
 */
export function OnboardingStepper({
  currentStep,
  completedSteps,
  furthestVisitedStep,
  firstNavigableStep,
  catalogAdditiveOpen = false,
  storeIsApproved = false,
  onNavigate,
}: StepperProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLButtonElement>(null)
  const [hidden, setHidden] = useState({ before: false, after: false })

  const stateOf = (step: OnboardingStep): StepState => {
    if (step < firstNavigableStep) return 'settled'
    if (step === currentStep) return 'current'
    if (completedSteps.includes(step)) return 'done'
    return step <= furthestVisitedStep ? 'open' : 'locked'
  }

  // Keep the active step visible when the row overflows. Scoped to the row's own
  // scroller rather than `scrollIntoView`, which would also scroll the form behind it.
  useEffect(() => {
    const scroller = scrollRef.current
    const node = currentRef.current
    if (!scroller || !node) return
    const scrollerBox = scroller.getBoundingClientRect()
    const nodeBox = node.getBoundingClientRect()
    const left = nodeBox.left - scrollerBox.left + scroller.scrollLeft - scroller.clientWidth / 2 + nodeBox.width / 2
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [currentStep])

  // An end fades only while steps are scrolled out past it. A fade at the true first or
  // last step would wash out a dot that is fully in view.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const measure = () => {
      const before = scroller.scrollLeft > 1
      const after = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
      setHidden((current) => current.before === before && current.after === after ? current : { before, after })
    }
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [])

  return (
    <nav aria-label="Onboarding progress">
      <div
        ref={scrollRef}
        data-fade-before={hidden.before || undefined}
        data-fade-after={hidden.after || undefined}
        className="ob-stepper-scroll overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Dots sit at fixed width with the links between them taking the slack, so the
            first and last dots land on the form’s edges (inset only by the current-step ring)
            and every link is the same length. */}
        <ol className="flex w-full min-w-max items-start px-1 pt-4 pb-8">
          {ONBOARDING_STEPS.map((item, index) => {
            const state = stateOf(item.step)
            const reachable = state === 'done' || state === 'open' || state === 'current'
            // A submitted store's catalog steps stay open for additions, so they carry a
            // small marker even while every other submitted step reads as done-and-locked.
            const additive = catalogAdditiveOpen && isAdditiveCatalogStep(item.step, storeIsApproved)
            const previous = ONBOARDING_STEPS[index - 1]
            const linkDone = previous
              ? ['done', 'settled'].includes(stateOf(previous.step))
              : false

            return (
              <li
                key={item.step}
                className={cn('flex items-start', index > 0 && 'min-w-19 flex-1 sm:min-w-22')}
              >
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-3.5 h-0.5 flex-1 rounded-full transition-colors',
                      linkDone ? 'bg-[var(--ob-brand)]' : 'bg-[var(--ob-line)]',
                    )}
                  />
                ) : null}

                <button
                  ref={state === 'current' ? currentRef : undefined}
                  type="button"
                  disabled={!reachable || state === 'current'}
                  aria-current={state === 'current' ? 'step' : undefined}
                  aria-label={`Step ${item.step}, ${item.short}. ${STATE_LABEL[state]}.${additive ? ' You can still add here.' : ''}`}
                  title={`${item.short}: ${STATE_LABEL[state].toLowerCase()}${additive ? ', still open for additions' : ''}`}
                  onClick={() => onNavigate(item.step)}
                  className={cn(
                    'group relative block size-7 shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]',
                    !reachable && 'cursor-not-allowed',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'ob-numeric relative z-10 grid size-7 place-items-center rounded-full border-2 text-[11px] font-extrabold transition-[background-color,border-color,color,box-shadow]',
                      state === 'done' && 'border-[var(--ob-brand)] bg-[var(--ob-brand)] text-white group-hover:bg-[var(--md-green-700)]',
                      state === 'current' && 'border-[var(--ob-brand)] bg-[var(--ob-brand)] text-white ring-4 ring-[var(--ob-brand-soft)]',
                      state === 'open' && 'border-[var(--ob-brand)]/40 bg-transparent text-[var(--ob-brand)] group-hover:border-[var(--ob-brand)] group-hover:bg-[var(--ob-brand-soft)]',
                      state === 'locked' && 'border-[var(--ob-line)] bg-transparent text-[var(--ob-pending)]',
                      state === 'settled' && 'border-[var(--ob-brand)]/50 bg-[var(--ob-brand)]/60 text-white',
                    )}
                  >
                    {state === 'done' ? (
                      <CheckIcon className="size-3.5 stroke-[3]" />
                    ) : state === 'settled' ? (
                      <LockKeyholeIcon className="size-3" />
                    ) : (
                      item.step
                    )}
                    {additive ? (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full bg-[var(--ob-brand)] text-white ring-2 ring-[var(--ob-canvas-base)]"
                      >
                        <PlusIcon className="size-2.5 stroke-[3]" />
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      // The end labels hang inward from their dots so they never pass the form's edges.
                      'absolute top-full mt-1.5 text-[11px] leading-4 font-medium whitespace-nowrap transition-colors',
                      index === 0 ? 'left-0' : index === ONBOARDING_STEPS.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                      state === 'current' && 'font-semibold text-[var(--ob-brand)]',
                      state === 'done' && 'text-[var(--ob-ink)]',
                      (state === 'open' || state === 'settled') && 'text-[var(--ob-ink-soft)]',
                      state === 'locked' && 'text-[var(--ob-pending)]',
                    )}
                  >
                    {item.short}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

    </nav>
  )
}
