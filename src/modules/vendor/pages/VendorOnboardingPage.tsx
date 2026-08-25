import { MarketingHeader } from '@/modules/marketing/components/MarketingHeader'
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'

export function VendorOnboardingPage() {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      <MarketingHeader />
      <div className="min-h-0 flex-1">
        <OnboardingWizard />
      </div>
    </div>
  )
}
