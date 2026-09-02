import { MarketingHero } from '@/modules/marketing/components/MarketingHero'
import { MarketingFooter } from '@/modules/marketing/components/MarketingFooter'
import {
  AudienceSection,
  ComparisonSection,
  ExploreStoresSection,
  FeaturesSection,
  HowItWorksSection,
  InvitationSection,
  PricingSection,
  TestimonialsSection,
  TrustedBySection,
} from '@/modules/marketing/components/MarketingLandingSections'
import { MarketingProductLoop } from '@/modules/marketing/components/MarketingProductLoop'

export function MarketingHomePage() {
  return (
    <>
      <MarketingHero />
      <MarketingProductLoop />
      <TrustedBySection />
      <FeaturesSection />
      <HowItWorksSection />
      <ExploreStoresSection />
      <AudienceSection />
      <div id="comparison" className="scroll-mt-24">
        <ComparisonSection />
      </div>
      <div id="testimonials" className="scroll-mt-24">
        <TestimonialsSection />
      </div>
      <PricingSection />
      <InvitationSection />
      <MarketingFooter />
    </>
  )
}
