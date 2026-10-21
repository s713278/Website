import { useRef, type ComponentType, type ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, ChartColumn, Check, Package, QrCode, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { FacebookLogo, InstagramLogo, WhatsAppLogo } from '@/modules/marketing/components/ChannelLogos'
import { SectionHeader } from '@/modules/marketing/components/MarketingLandingSections'
import { usePlanBarVisible, usePricingStage } from '@/modules/marketing/hooks/usePricingStage'
import {
  formatPlanPrice,
  planSavings,
  starterFeatureGroups,
  starterPlan,
  type StarterFeatureGroup,
} from '@/modules/marketing/lib/pricing-plans'

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

const featureGroupStyles: Record<
  StarterFeatureGroup['id'],
  { icon: Icon; tile: string; disc: string; ring: string }
> = {
  store: { icon: Store, tile: 'bg-violet-100 text-violet-600', disc: 'bg-violet-100', ring: 'border-violet-200' },
  channels: { icon: ArrowUpRight, tile: 'bg-green-100 text-emerald-700', disc: 'bg-green-100', ring: 'border-green-200' },
  catalog: { icon: Package, tile: 'bg-orange-100 text-orange-600', disc: 'bg-orange-100', ring: 'border-orange-200' },
  insights: { icon: ChartColumn, tile: 'bg-blue-100 text-blue-600', disc: 'bg-blue-100', ring: 'border-blue-200' },
}

// Insights chart bars (heights 46, 70, 58, 96, 84, 120), bottoms aligned on the 185px baseline.
const chartBars = [
  'top-[139px] left-[23px] h-[46px] bg-emerald-500',
  'top-[115px] left-[59px] h-[70px] bg-emerald-500',
  'top-[127px] left-[95px] h-[58px] bg-emerald-500',
  'top-[89px] left-[131px] h-[96px] bg-emerald-500',
  'top-[101px] left-[167px] h-[84px] bg-emerald-500',
  'top-[65px] left-[203px] h-[120px] bg-emerald-600',
]

const artTile = 'absolute rounded-[18px] border border-slate-200 bg-white shadow-[0_14px_15px_rgba(15,23,42,0.1)]'

function StarterTrialLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to={starterPlan.to}
      className={cn(
        'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-3 py-3 text-center text-[0.85rem] font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(16,185,129,0.35)] min-[481px]:px-6 min-[481px]:text-[0.95rem]',
        className,
      )}
    >
      {starterPlan.cta} <ArrowRight className="size-4 shrink-0" aria-hidden />
    </Link>
  )
}

function FeatureArt({ id }: { id: StarterFeatureGroup['id'] }) {
  if (id === 'store') {
    return (
      <>
        <div className="absolute top-[26px] left-[62px] h-[300px] w-[164px] overflow-hidden rounded-[30px] bg-slate-900 shadow-[0_14px_30px_-6px_rgba(15,23,42,0.1)]">
          <div className="absolute top-[7px] left-[7px] h-[286px] w-[150px] overflow-hidden rounded-[24px] bg-white">
            <span className="absolute inset-x-0 top-0 h-[78px] bg-violet-100" />
            <span className="absolute top-[58px] left-[14px] size-9 rounded-full border-2 border-white bg-violet-600" />
            <strong className="absolute top-[102px] left-[14px] text-[13px] leading-[18px] font-medium text-slate-900">
              Your Store
            </strong>
            <span className="absolute top-[124px] left-[14px] h-1.5 w-[70px] rounded-[3px] bg-slate-200" />
            <span className="absolute top-[144px] left-[14px] size-[58px] rounded-xl bg-green-100" />
            <span className="absolute top-[208px] left-[14px] h-1.5 w-[46px] rounded-[3px] bg-slate-200" />
            <span className="absolute top-[220px] left-[14px] h-1.5 w-[30px] rounded-[3px] bg-slate-100" />
            <span className="absolute top-[144px] left-[78px] size-[58px] rounded-xl bg-orange-100" />
            <span className="absolute top-[208px] left-[78px] h-1.5 w-[46px] rounded-[3px] bg-slate-200" />
            <span className="absolute top-[220px] left-[78px] h-1.5 w-[30px] rounded-[3px] bg-slate-100" />
            <span className="absolute top-[246px] left-[14px] h-[26px] w-[122px] rounded-[13px] bg-emerald-600" />
          </div>
        </div>
        <div className={cn(artTile, 'top-[212px] left-[196px] grid size-[88px] place-items-center')}>
          <QrCode className="size-[52px] text-slate-900" aria-hidden />
        </div>
      </>
    )
  }
  if (id === 'channels') {
    return (
      <>
        <div className={cn(artTile, 'top-[70px] left-[40px] grid size-[104px] place-items-center rounded-[28px]')}>
          <WhatsAppLogo className="size-14" />
        </div>
        <div className={cn(artTile, 'top-[40px] left-[168px] grid size-[84px] place-items-center rounded-[24px]')}>
          <InstagramLogo className="size-[46px]" />
        </div>
        <div className={cn(artTile, 'top-[196px] left-[150px] grid size-[76px] place-items-center rounded-[22px]')}>
          <FacebookLogo className="size-[42px]" />
        </div>
        <div className={cn(artTile, 'top-[214px] left-[28px] h-9 w-28')}>
          <span className="absolute top-[13px] left-[13px] size-2 rounded-full bg-emerald-500" />
          <span className="absolute top-[14px] left-[29px] h-1.5 w-[66px] rounded-[3px] bg-slate-200" />
        </div>
      </>
    )
  }
  if (id === 'catalog') {
    return (
      <>
        <span className="absolute top-[48px] left-[73px] h-[236px] w-[170px] rotate-6 rounded-[18px] border border-slate-200 bg-white opacity-70" />
        <div className="absolute top-[52px] left-[54px] h-[250px] w-[184px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_14px_30px_-6px_rgba(15,23,42,0.1)]">
          <span className="absolute top-[9px] left-[9px] grid h-[124px] w-[164px] place-items-center rounded-[14px] bg-orange-100">
            <Package className="size-11 text-orange-600" aria-hidden />
          </span>
          <span className="absolute top-[147px] left-[15px] h-2 w-[110px] rounded-[4px] bg-slate-200" />
          <span className="absolute top-[163px] left-[15px] h-2 w-16 rounded-[4px] bg-slate-100" />
          <strong className="absolute top-[199px] left-[15px] text-base leading-6 font-semibold text-slate-900">₹250</strong>
          <span className="absolute top-[197px] left-[111px] rounded-full bg-emerald-600 px-4 py-1.5 text-[13px] leading-[18px] font-medium text-white">
            Add
          </span>
        </div>
      </>
    )
  }
  return (
    <div className={cn(artTile, 'top-[70px] left-[30px] h-[210px] w-[250px] rounded-[20px]')}>
      <span className="absolute top-[21px] left-[19px] h-2 w-20 rounded-[4px] bg-slate-200" />
      <span className="absolute top-[37px] left-[19px] h-3 w-[120px] rounded-[6px] bg-slate-900" />
      {chartBars.map((bar) => (
        <span key={bar} className={cn('absolute w-[22px] rounded-[6px]', bar)} />
      ))}
      <span className="absolute top-[185px] left-[19px] h-px w-[210px] bg-slate-200" />
    </div>
  )
}

function PricingCheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-[0.45rem] text-[0.84rem] text-gray-700 [overflow-wrap:anywhere] min-[481px]:text-[0.9rem]">
      <Check className="mt-[0.2rem] size-[0.9rem] shrink-0 stroke-[3] text-emerald-600" aria-hidden />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function FeatureCard({ group }: { group: StarterFeatureGroup }) {
  const { icon: GroupIcon, tile, disc, ring } = featureGroupStyles[group.id]
  return (
    <article
      data-pricing-card
      className="flex min-w-0 rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_2px_6px_rgba(15,23,42,0.04),0_20px_48px_-12px_rgba(15,23,42,0.06)] md:min-h-[420px] md:items-center md:gap-10 md:rounded-[22px] md:py-10 md:pr-10 md:pl-11"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-5 md:gap-6">
        <span
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-[12px] md:size-[52px] md:rounded-[14px]',
            tile,
          )}
        >
          <GroupIcon className="size-[22px] md:size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h4 className="font-display text-[22px] leading-[30px] font-semibold tracking-[-0.5px] text-slate-900 md:text-[28px] md:leading-9">
            {group.title}
          </h4>
          <p className="mt-2 text-pretty text-sm leading-[22px] text-slate-600 md:mt-2.5 md:text-base md:leading-[26px]">
            {group.copy}
          </p>
        </div>
        <ul className="grid gap-3">
          {group.features.map((feature) => (
            <li
              key={feature}
              className="flex min-w-0 items-start gap-2.5 text-sm leading-[22px] font-medium text-slate-700 [overflow-wrap:anywhere] md:gap-3 md:text-[15px]"
            >
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 md:mt-0 md:size-[22px]">
                <Check className="size-3 stroke-[3] text-emerald-600 md:size-[13px]" aria-hidden />
              </span>
              <span className="min-w-0">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative hidden h-[340px] w-[300px] shrink-0 md:block lg:max-xl:hidden" aria-hidden>
        <span className={cn('absolute top-5 left-0 size-[300px] rounded-full border', ring)} />
        <span className={cn('absolute top-[50px] left-[30px] size-[240px] rounded-full', disc)} />
        <FeatureArt id={group.id} />
      </div>
    </article>
  )
}

/** Compact plan bar fixed to the viewport bottom below `lg`, shown by `usePlanBarVisible`. */
function PlanBar({ visible }: { visible: boolean }) {
  return (
    <div
      data-pricing-bar
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2.5 border-t border-slate-200 bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(15,23,42,0.1)] motion-safe:transition-[transform,translate,visibility] md:flex-row md:gap-5 md:px-8 md:pt-4 md:pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden',
        !visible && 'invisible translate-y-full',
      )}
    >
      <div className="min-w-0 text-center md:flex-1 md:text-left">
        <p className="hidden truncate text-base leading-6 font-semibold text-slate-900 md:block">{starterPlan.name}</p>
        <p className="text-[13px] leading-[18px] font-medium text-slate-600 md:text-sm md:leading-[22px] md:font-normal">
          <strong className="font-semibold text-slate-900">{formatPlanPrice(starterPlan.price)}</strong>
          <span>/month · {starterPlan.trialDays} days free to try</span>
        </p>
      </div>
      <StarterTrialLink className="min-h-[50px] px-[22px] text-base font-semibold whitespace-nowrap min-[481px]:px-[22px] min-[481px]:text-base md:w-[277px] md:shrink-0" />
    </div>
  )
}

export function PricingSection() {
  const savings = planSavings(starterPlan)
  const rootRef = useRef<HTMLElement>(null)
  usePricingStage(rootRef)
  const planBarShown = usePlanBarVisible(rootRef)
  return (
    <section ref={rootRef} id="pricing" className="scroll-mt-24 marketing-gutter py-16 sm:py-24 bg-slate-50">
      <div className="marketing-measure">
        <SectionHeader
          title={
            <>
              Your own online store
              <br />
              One simple plan
            </>
          }
          copy={
            <>
              Put your shop online, share it with customers, and manage orders from one place.{' '}
              <br className="hidden md:inline" />
              Start with a {starterPlan.trialDays}-day free trial, then pay one flat monthly price.
            </>
          }
        />
        <div className="mt-6 grid min-w-0 items-start gap-5 sm:mt-10 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:gap-16">
          <article
            data-pricing-plan
            className="min-w-0 self-start rounded-2xl border-2 border-emerald-500 bg-white px-4 py-[1.15rem] shadow-[0_12px_40px_rgba(16,185,129,0.12)] min-[481px]:rounded-[1.35rem] min-[481px]:px-[1.2rem] min-[481px]:pt-[1.35rem] min-[481px]:pb-5 md:grid md:grid-cols-2 md:gap-8 lg:top-[var(--pricing-pin-top,calc(var(--header-height)+1rem))] lg:block lg:[@media(min-height:680px)]:sticky"
          >
            <div className="min-w-0">
              <p className="mb-[0.15rem] inline-flex rounded-full bg-emerald-50 px-[0.7rem] py-[0.35rem] text-xs font-extrabold text-emerald-900">
                {starterPlan.trialDays} days free to try
              </p>
              <h3 className="mt-[0.85rem] text-balance font-display text-[1.35rem] font-bold text-gray-900">
                {starterPlan.name}
              </h3>
              <p className="mt-[0.4rem] text-pretty text-[0.92rem] text-gray-600">{starterPlan.audience}</p>
              <p className="mt-[1.1rem] flex flex-wrap items-center gap-2 text-[1.05rem] font-medium text-gray-500">
                <span className="sr-only">Original price </span>
                <s>{formatPlanPrice(starterPlan.originalPrice)}</s>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-900">
                  Save {formatPlanPrice(savings)}
                </span>
              </p>
              <p className="mt-[0.15rem] flex flex-wrap items-baseline gap-x-[0.45rem] gap-y-[0.35rem]">
                <span className="sr-only">Price </span>
                <strong className="font-display text-[clamp(2.35rem,12vw,3rem)] leading-none font-bold tracking-[-0.03em] text-gray-900 min-[481px]:text-[clamp(2.5rem,6vw,3.15rem)]">
                  {formatPlanPrice(starterPlan.price)}
                </strong>
                <span className="text-[0.95rem] font-semibold text-gray-500">/month</span>
              </p>
              <p className="mt-[0.35rem] text-[0.82rem] font-bold text-emerald-600">
                About {formatPlanPrice(starterPlan.approxDailyPrice)} a day
              </p>
            </div>
            <div className="min-w-0 md:flex md:flex-col lg:block">
              <p className="mt-1 text-[0.8rem] leading-normal text-gray-500 min-[481px]:text-[0.85rem] md:mt-3 md:text-center lg:mt-1 lg:text-left">
                {starterPlan.trialDays}-day free trial · Monthly billing after trial · Before applicable taxes
              </p>
              <StarterTrialLink className="mt-[1.05rem] md:order-first md:mt-0 lg:order-none lg:mt-[1.05rem]" />
              <ul className="mt-[0.9rem] grid gap-[0.4rem]">
                {starterPlan.highlights.map((highlight) => (
                  <PricingCheckItem key={highlight}>{highlight}</PricingCheckItem>
                ))}
              </ul>
            </div>
          </article>
          <div className="min-w-0">
            <div data-pricing-head className="pb-5">
              <h3 className="font-display text-xl leading-7 font-semibold tracking-[-0.2px] text-slate-900">
                What’s included
              </h3>
            </div>
            <div data-pricing-cards className="grid gap-4 md:gap-6">
              {starterFeatureGroups.map((group) => (
                <FeatureCard key={group.id} group={group} />
              ))}
            </div>
          </div>
        </div>
        <p
          data-pricing-footnote
          className="mt-12 text-pretty text-[0.73rem] leading-[1.55] text-gray-500 min-[481px]:text-[0.78rem] md:text-center"
        >
          *MithraDirect charges no commission on sales. Payment-provider and other third-party fees may still apply.
          Vendors manage their own products, pricing, payments, fulfilment, delivery, returns, and customer service.
        </p>
      </div>
      <PlanBar visible={planBarShown} />
    </section>
  )
}
