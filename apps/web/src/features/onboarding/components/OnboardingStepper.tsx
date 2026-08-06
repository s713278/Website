import { ONBOARDING_STEPS } from '@/features/onboarding/data/constants';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { cn } from '@/shared/lib/utils';

export function OnboardingStepper() {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const maxReachedStep = useOnboardingStore((s) => s.maxReachedStep);
  const goToStep = useOnboardingStore((s) => s.goToStep);

  return (
    <nav
      className="flex gap-0 overflow-x-auto py-2 scrollbar-thin"
      aria-label="Onboarding progress"
    >
      {ONBOARDING_STEPS.map((step, index) => {
        const active = step.n === currentStep;
        const done = step.n < currentStep;
        const reachable = step.n <= maxReachedStep;
        const isLast = index === ONBOARDING_STEPS.length - 1;

        return (
          <div
            key={step.n}
            className={cn(
              'relative min-w-[4.5rem] flex-1 text-center transition-opacity',
              active || done ? 'opacity-100' : reachable ? 'opacity-70' : 'opacity-45',
            )}
          >
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[calc(50%+1.25rem)] right-[calc(-50%+1.25rem)] top-[1.125rem] z-0 h-0.5',
                  done ? 'bg-emerald-500' : 'bg-gray-300',
                )}
              />
            ) : null}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => goToStep(step.n)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${step.n}: ${step.label}${done ? ', completed' : ''}`}
              className={cn(
                'relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                active || done
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-gray-200 text-gray-500',
                reachable ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              {done ? '✓' : step.n}
            </button>
            <div className="mt-1.5 text-[0.7rem] font-semibold leading-tight text-gray-700">
              {step.label}
            </div>
            <div className="text-[0.65rem] text-gray-400">{step.time}</div>
          </div>
        );
      })}
    </nav>
  );
}
