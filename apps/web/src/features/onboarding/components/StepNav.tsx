import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { cn } from '@/shared/lib/utils';

type StepNavProps = {
  nextLabel?: string;
  hideBack?: boolean;
  onNext?: () => void;
};

export function StepNav({ nextLabel = 'Continue', hideBack, onNext }: StepNavProps) {
  const goBack = useOnboardingStore((s) => s.goBack);
  const goNext = useOnboardingStore((s) => s.goNext);

  return (
    <div className={cn('mt-8 flex', hideBack ? 'justify-end' : 'justify-between')}>
      {!hideBack ? (
        <button type="button" onClick={goBack} className="btn-back px-5 py-2.5">
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={() => {
          if (onNext) onNext();
          else goNext();
        }}
        className="btn-primary-md rounded-full px-8 py-2.5 font-semibold"
      >
        {nextLabel}
      </button>
    </div>
  );
}
