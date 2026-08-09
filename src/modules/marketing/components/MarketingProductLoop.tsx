import { Link } from 'react-router-dom'

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
    to: '/register',
    active: false,
  },
  {
    num: '3',
    title: 'Customer store',
    subtitle: 'WhatsApp checkout',
    to: '/stores/r1',
    active: false,
  },
] as const

export function MarketingProductLoop() {
  return (
    <section
      className="border-y border-slate-200 bg-white py-4"
      aria-label="Product demo path"
      id="how-it-works"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 md:flex-row md:items-center md:justify-between">
        <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          See the product loop
        </p>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-2 md:gap-3">
          {steps.map((step, index) => (
            <div key={step.num} className="flex items-center gap-2 md:gap-3">
              {index > 0 ? (
                <span className="hidden text-slate-300 sm:inline" aria-hidden>
                  →
                </span>
              ) : null}
              {'to' in step ? (
                <Link
                  to={step.to}
                  className="inline-flex items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-emerald-50"
                >
                  <StepBadge num={step.num} active={step.active} />
                  <StepText title={step.title} subtitle={step.subtitle} />
                </Link>
              ) : (
                <a
                  href={step.href}
                  className="inline-flex items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-emerald-50"
                >
                  <StepBadge num={step.num} active={step.active} />
                  <StepText title={step.title} subtitle={step.subtitle} />
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-4 text-sm font-semibold text-emerald-700">
          <a
            href="https://www.instagram.com/mithradirect/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Instagram
          </a>
          <a
            href="https://www.youtube.com/@MithraDirect"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            YouTube
          </a>
        </div>
      </div>
    </section>
  )
}

function StepBadge({ num, active }: { num: string; active: boolean }) {
  return (
    <span
      className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${
        active ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {num}
    </span>
  )
}

function StepText({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="leading-tight">
      <strong className="block text-sm text-slate-800">{title}</strong>
      <em className="block text-xs not-italic text-slate-500">{subtitle}</em>
    </span>
  )
}
