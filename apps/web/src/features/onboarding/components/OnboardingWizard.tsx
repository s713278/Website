import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { StepVerifyPhone } from '@/features/onboarding/steps/StepVerifyPhone';
import { StepEnterOtp } from '@/features/onboarding/steps/StepEnterOtp';
import { StepBusinessType } from '@/features/onboarding/steps/StepBusinessType';
import { StepCategories } from '@/features/onboarding/steps/StepCategories';
import { StepProducts } from '@/features/onboarding/steps/StepProducts';
import { StepPrices } from '@/features/onboarding/steps/StepPrices';
import { StepDelivery } from '@/features/onboarding/steps/StepDelivery';
import { StepPayments } from '@/features/onboarding/steps/StepPayments';
import { StepStoreSettings } from '@/features/onboarding/steps/StepStoreSettings';
import { StepSuccess } from '@/features/onboarding/steps/StepSuccess';

const STEPS = {
  1: StepVerifyPhone,
  2: StepEnterOtp,
  3: StepBusinessType,
  4: StepCategories,
  5: StepProducts,
  6: StepPrices,
  7: StepDelivery,
  8: StepPayments,
  9: StepStoreSettings,
  10: StepSuccess,
} as const;

export function OnboardingWizard() {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const Step = STEPS[currentStep as keyof typeof STEPS] || StepVerifyPhone;

  return (
    <div className="min-h-[420px] rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
      <Step />
    </div>
  );
}
