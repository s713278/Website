export type PrototypeTone = 'neutral' | 'danger' | 'warning'

/** The main Plan card for one prototype state, as in its mockup. */
export interface PrototypeCard {
  tone: PrototypeTone
  eyebrow: string
  /** A days-left count, or a headline where the mockup has one. */
  figure: { days: number } | { headline: string }
  body: string
  plan: string
  /** Where the state comes from: the seeded Paid says it took no payment; a real plan's Stopped names its source. */
  sample: string | null
  action: { label: string } | null
  /** Trial AutoPay that Razorpay Test has confirmed, with its first-fee date. */
  autoPay: string | null
}

/** The state's banner: a bold lead, the rest of the sentence and the label of its link to Plan. */
export interface PrototypeBanner { tone: PrototypeTone; lead: string; text: string; action: string }

const dayMs = 24 * 60 * 60 * 1000
/** India is UTC+5:30 all year, so its calendar day is a fixed offset from UTC. */
const indiaDay = (at: number) => Math.floor((at + 5.5 * 60 * 60 * 1000) / dayMs)

/** How long ago `at` was, in India calendar days from `now` (the helper's read time). */
export function relativeDay(at: string, now: Date): string {
  const days = Math.max(0, indiaDay(now.getTime()) - indiaDay(Date.parse(at)))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 28) return `${days} days ago`
  if (days < 60) return 'Last month'
  return `${Math.floor(days / 30)} months ago`
}
