import { useEffect } from 'react';
import { applyVendorTheme } from '@mithra/ui';
import { DraftSaveStatus } from '@/features/onboarding/components/DraftSaveStatus';
import { ErrorRecoveryBanner } from '@/features/onboarding/components/ErrorRecoveryBanner';
import { OnboardingHeader } from '@/features/onboarding/components/OnboardingHeader';
import { OnboardingStepper } from '@/features/onboarding/components/OnboardingStepper';
import { OnboardingSummaryBar } from '@/features/onboarding/components/OnboardingSummaryBar';
import { OnboardingWizard } from '@/features/onboarding/components/OnboardingWizard';
import { StorefrontPreview } from '@/features/onboarding/components/StorefrontPreview';
import { useStoreSetupAutosave } from '@/features/onboarding/hooks/use-store-setup-autosave';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function OnboardingHomePage() {
  useStoreSetupAutosave();
  const themeColor = useOnboardingStore((s) => s.settings.themeColor);
  const hydrated = useOnboardingStore((s) => s.hydrated);

  useEffect(() => {
    applyVendorTheme(themeColor || '#10b981');
  }, [themeColor]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-gray-500">
        Restoring your store setup draft…
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--md-atmosphere)] pb-28 text-gray-800">
      <OnboardingHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              Setup Your Insta &amp; WhatsApp Store
            </h1>
            <p className="mt-1 text-sm text-gray-500 sm:text-base">
              Complete these steps — your storefront updates live on the right.
            </p>
          </div>
          <DraftSaveStatus />
        </div>

        <OnboardingStepper />
        <ErrorRecoveryBanner />

        <div className="mt-4 grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <OnboardingWizard />
          </div>
          <div className="lg:col-span-2">
            <StorefrontPreview />
          </div>
        </div>
      </main>
      <OnboardingSummaryBar />
    </div>
  );
}
