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
        <button
          type="button"
          onClick={goBack}
          className="rounded-full border border-gray-200 px-5 py-2.5 font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
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
        className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-2.5 font-semibold text-white shadow-md shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
      >
        {nextLabel}
      </button>
    </div>
  );
}
