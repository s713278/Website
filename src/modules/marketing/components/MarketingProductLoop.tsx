import { Link } from 'react-router-dom'
import { InstagramLogo, YouTubeLogo } from './ChannelLogos'

const steps = [
  {
    num: '1',
    title: 'Landing',
    subtitle: 'Value & pricing',
    href: '/#top',
    active: true,
  },
  {
    num: '2',
    title: 'Vendor setup',
    subtitle: 'Live in minutes',
    to: '/onboarding',
    newTab: true,
    active: false,
  },
  {
    num: '3',
    title: 'Customer store',
    subtitle: 'WhatsApp checkout',
    // Not linked for the first production phase (/stores is hidden); restore with `to: '/stores'`.
    // to: '/stores',
    active: false,
  },
] as const

const channels = [
  { label: 'MithraDirect on Instagram', href: 'https://www.instagram.com/mithradirect/', Logo: InstagramLogo },
  { label: 'MithraDirect on YouTube', href: 'https://www.youtube.com/@MithraDirect', Logo: YouTubeLogo },
]

const stepClass =
  'group mx-auto flex w-fit max-w-full flex-col items-center gap-2 text-center outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-emerald-600 focus-visible:[&>span:first-child]:ring-offset-2'

export function MarketingProductLoop() {
  return (
    <section className="border-y border-slate-200 bg-white py-5 sm:py-6" aria-label="Product demo path">
      {/* Phone and tablet: label, steps and icons stack, centred. Desktop: one balanced row, with
          the label left, the steps centred and the channel icons right. */}
      <div className="marketing-measure marketing-gutter box-content flex flex-col items-center gap-4 lg:grid lg:grid-cols-[1fr_minmax(0,32rem)_1fr] lg:gap-6">
        <p className="whitespace-nowrap text-center text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 lg:justify-self-start lg:text-left">
          See the product loop
        </p>
        {/* One stepper at every width: three equal cells, the badge row threaded by a rule that
            runs edge to edge (emerald up to the current step), copy centred beneath each badge. */}
        <ol className="grid w-full max-w-xl grid-cols-3 lg:max-w-none">
          {steps.map((step, index) => (
            <li key={step.num} className="relative">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={`absolute left-0 top-[15px] h-0.5 w-[calc(50%-1.75rem)] rounded-full ${
                    steps[index - 1].active ? 'bg-emerald-300' : 'bg-slate-200'
                  }`}
                />
              ) : null}
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={`absolute right-0 top-[15px] h-0.5 w-[calc(50%-1.75rem)] rounded-full ${
                    step.active ? 'bg-emerald-300' : 'bg-slate-200'
                  }`}
                />
              ) : null}
              {'to' in step ? (
                <Link
                  to={step.to}
                  {...('newTab' in step ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={stepClass}
                >
                  <StepBadge num={step.num} active={step.active} />
                  <StepText title={step.title} subtitle={step.subtitle} />
                  {'newTab' in step ? <span className="sr-only">(opens in a new tab)</span> : null}
                </Link>
              ) : 'href' in step ? (
                <a href={step.href} className={stepClass}>
                  <StepBadge num={step.num} active={step.active} />
                  <StepText title={step.title} subtitle={step.subtitle} />
                </a>
              ) : (
                <span className={stepClass}>
                  <StepBadge num={step.num} active={step.active} />
                  <StepText title={step.title} subtitle={step.subtitle} />
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-1 flex justify-center gap-2 lg:mt-0 lg:justify-self-end">
          {channels.map(({ label, href, Logo }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:size-9"
            >
              <Logo tone="current" className="size-[18px]" />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function StepBadge({ num, active }: { num: string; active: boolean }) {
  return (
    <span
      className={`relative flex size-8 items-center justify-center rounded-full font-display text-sm font-semibold transition ${
        active
          ? 'bg-emerald-600 text-white shadow-[0_6px_14px_-6px_rgba(5,150,105,0.7)]'
          : 'bg-white text-slate-600 ring-1 ring-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:ring-emerald-400'
      }`}
    >
      {num}
    </span>
  )
}

function StepText({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="block max-w-full text-balance px-0.5 leading-tight">
      <strong className="block font-display text-[13px] font-semibold text-slate-900 transition group-hover:text-emerald-700 sm:text-sm">
        {title}
      </strong>
      <em className="mt-0.5 block text-[11px] not-italic sm:text-xs text-slate-500">{subtitle}</em>
    </span>
  )
}
