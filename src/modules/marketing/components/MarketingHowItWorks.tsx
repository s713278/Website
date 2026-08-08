const STEPS = [
  { title: 'Browse nearby', body: 'See stores by ETA, rating, and category.' },
  { title: 'Build your cart', body: 'Add products from one store and checkout.' },
  { title: 'Vendors fulfil live', body: 'Partner stores accept and progress tickets.' },
]

export function MarketingHowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="font-display text-2xl font-bold md:text-3xl">How it works</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Marketing, storefront, and vendor modules — one React app, clear boundaries.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="rounded-[var(--md-radius)] border border-[var(--md-border)] bg-white/80 p-5"
          >
            <p className="text-sm font-bold text-emerald-700">Step {index + 1}</p>
            <h3 className="font-display mt-2 text-xl font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
