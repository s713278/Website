import { useEffect, useRef } from 'react'
import { CheckIcon, LockKeyholeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS, type OnboardingStep } from '../../types/onboarding'

type StepState = 'settled' | 'done' | 'current' | 'open' | 'locked'

const STATE_LABEL: Record<StepState, string> = {
  settled: 'Verified. Your store is live, so this is fixed',
  done: 'Done',
  current: 'You are here',
  open: 'Ready when you are',
  locked: 'Comes later',
}

export type StepperProps = {
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  furthestVisitedStep: OnboardingStep
  /** Steps below this belong to a live store and can no longer be changed. */
  firstNavigableStep: OnboardingStep
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
  onNavigate,
}: StepperProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLLIElement>(null)

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
    const left = node.offsetLeft - scroller.clientWidth / 2 + node.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [currentStep])

  return (
    <nav aria-label="Onboarding progress">
      <div ref={scrollRef} className="ob-stepper-scroll overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="mx-auto flex w-full min-w-max max-w-[54rem] items-start px-4 pt-4 pb-3 sm:px-6">
          {ONBOARDING_STEPS.map((item, index) => {
            const state = stateOf(item.step)
            const reachable = state === 'done' || state === 'open' || state === 'current'
            const previous = ONBOARDING_STEPS[index - 1]
            const linkDone = previous
              ? ['done', 'settled'].includes(stateOf(previous.step))
              : false

            return (
              <li
                key={item.step}
                ref={state === 'current' ? currentRef : undefined}
                className="relative flex min-w-19 flex-1 flex-col items-center sm:min-w-22"
              >
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-3.5 right-1/2 left-[calc(-50%+0.875rem)] h-0.5 rounded-full transition-colors',
                      linkDone ? 'bg-[var(--ob-brand)]' : 'bg-[var(--ob-line)]',
                    )}
                  />
                ) : null}

                <button
                  type="button"
                  disabled={!reachable || state === 'current'}
                  aria-current={state === 'current' ? 'step' : undefined}
                  aria-label={`Step ${item.step}, ${item.short}. ${STATE_LABEL[state]}.`}
                  title={`${item.short}: ${STATE_LABEL[state].toLowerCase()}`}
                  onClick={() => onNavigate(item.step)}
                  className={cn(
                    'group flex w-full flex-col items-center gap-1.5 rounded-lg px-1 pb-0.5 outline-none focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]',
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
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'max-w-full truncate text-[11px] leading-4 font-medium transition-colors',
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
