import { useEffect, useId, useMemo, type ReactNode } from 'react'
import type { PrototypeCard } from '@/modules/vendor/lib/billing-prototype-card'
import { liveBillingWording } from '@/modules/vendor/lib/live-billing-wording'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { readLiveBilling, useLiveBilling } from '@/modules/vendor/store/live-billing'
import { getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card } from '@/shared/components/ui'
import { cn } from '@/shared/lib/utils'

const toneClass: Record<PrototypeCard['tone'], string> = {
  neutral: '',
  danger: 'border-destructive/30 bg-destructive/[0.04]',
  warning: 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30',
}

function StateCard({ card }: { card: PrototypeCard }) {
  return <Card className={cn('grid gap-3 p-5', toneClass[card.tone])}>
    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{card.eyebrow}</p>
    {'days' in card.figure
      ? <p className="flex items-baseline gap-2"><span className="font-display text-5xl font-bold">{card.figure.days}</span><span className="text-lg text-muted-foreground">days left</span></p>
      : <h2 className="font-display text-4xl font-bold">{card.figure.headline}</h2>}
    <p>{card.body}</p>
    <p className="text-sm font-semibold text-primary">{card.plan}</p>
    {card.autoPay ? <p className="font-semibold text-primary">{card.autoPay}</p> : null}
  </Card>
}

const whatYouGet = ['Your own shop link', 'Customers order on WhatsApp', 'Share on Instagram and Facebook', 'Add products and prices', 'See all orders in one place']
const ifYouDoNotPay = ['Customers cannot open your shop', 'New orders stop', 'You can still see old orders', 'You can pay again any time']

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return <Card role="region" aria-labelledby={id} className="grid gap-3 p-5">
    <h2 id={id} className="font-display text-lg font-bold">{title}</h2>
    {children}
  </Card>
}

/** Plan with the Live API: the vendor's billing state from the published backend billing API. */
export function LiveVendorPlan() {
  const { vendorId } = useVendorAccount()
  // A new session clears the shared read, even for the same vendor, so Plan reads again.
  const sessionUser = useAuthStore((state) => state.user)
  const { view, error, reading } = useLiveBilling(vendorId)
  const errorMessage = useMemo(() => error ? getErrorMessage(error) : null, [error])

  // The shared read drops a response for a previous vendor or session, so there is nothing to cancel here.
  useEffect(() => { void readLiveBilling(vendorId) }, [vendorId, sessionUser])

  if (errorMessage) return <div className="grid gap-2 text-sm">
    <p role="alert" className="text-destructive">{errorMessage}</p>
    <Button className="w-fit" variant="outline" size="sm" disabled={reading} onClick={() => void readLiveBilling(vendorId)}>Try again</Button>
  </div>
  if (!view) return <p role="status">Reading shop plan…</p>

  const { card, note, confirming } = liveBillingWording(view)
  return <div className="grid gap-4">
    {note ? <Card className="p-5"><p>{note}</p></Card> : null}
    {card ? <>
      <StateCard card={card} />
      {/* Confirming offers no payment action; Check again only rereads the shared read. */}
      {confirming ? <div className="grid gap-2 text-sm">
        <p role="status">{confirming}</p>
        <Button className="w-fit" variant="outline" size="sm" disabled={reading} onClick={() => void readLiveBilling(vendorId)}>Check again</Button>
      </div> : null}
      <Section title="What you get">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">{whatYouGet.map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>
      {/* Hidden while paid or while Razorpay collects: the vendor has nothing to pay. */}
      {view.state !== 'collecting' && view.state !== 'paid' ? <Section title="If you do not pay">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm text-[var(--badge-warning-fg)]">{ifYouDoNotPay.map((item) => <li key={item}>{item}</li>)}</ul>
      </Section> : null}
    </> : null}
  </div>
}
