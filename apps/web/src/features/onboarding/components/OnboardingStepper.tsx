import { ONBOARDING_STEPS } from '@/features/onboarding/data/constants';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { cn } from '@/shared/lib/utils';

export function OnboardingStepper() {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const maxReachedStep = useOnboardingStore((s) => s.maxReachedStep);
  const goToStep = useOnboardingStore((s) => s.goToStep);

  return (
    <nav className="stepper" aria-label="Onboarding progress">
      {ONBOARDING_STEPS.map((step) => {
        const active = step.n === currentStep;
        const done = step.n < currentStep;
        const reachable = step.n <= maxReachedStep;

        return (
          <div
            key={step.n}
            className={cn(
              'stepper-item',
              active && 'active',
              done && 'done',
              reachable && 'reachable',
            )}
          >
            <button
              type="button"
              disabled={!reachable}
              onClick={() => goToStep(step.n)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${step.n}: ${step.label}${done ? ', completed' : ''}`}
              className="stepper-num"
            >
              {done ? '✓' : step.n}
            </button>
            <div className="stepper-label">{step.label}</div>
            <div className="stepper-time">{step.time}</div>
          </div>
        );
      })}
    </nav>
  );
}
