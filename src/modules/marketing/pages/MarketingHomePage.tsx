import { MarketingHero } from '@/modules/marketing/components/MarketingHero'
import { MarketingHowItWorks } from '@/modules/marketing/components/MarketingHowItWorks'
import { MarketingProductLoop } from '@/modules/marketing/components/MarketingProductLoop'

export function MarketingHomePage() {
  return (
    <>
      <MarketingHero />
      <MarketingProductLoop />
      <p className="bg-white py-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        Trusted by thousands of local sellers
      </p>
      <div id="about" className="scroll-mt-24">
        <MarketingHowItWorks />
      </div>
      <section id="features" className="scroll-mt-24" aria-hidden />
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16">
        <h2 className="font-display text-2xl font-bold md:text-3xl">Simple pricing</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Start free. Zero commission on WhatsApp orders. Scale when you’re ready.
        </p>
      </section>
    </>
  )
}
