import { describe, expect, it } from 'vitest'
import { prototypeSeed, prototypeStates } from '@/shared/api'
import { prototypeBanner, prototypeCard, prototypeHistory, relativeDay } from './billing-prototype-card'

const selectedAt = new Date('2026-09-24T10:00:00Z')
type State = Parameters<typeof prototypeSeed>[0]
const cardAt = (state: State, now = selectedAt) => prototypeCard(state, prototypeSeed(state, selectedAt), now)
const bannerAt = (state: State, now = selectedAt) => prototypeBanner(state, prototypeSeed(state, selectedAt), now)
const historyAt = (state: State, now = selectedAt) => prototypeHistory(prototypeSeed(state, selectedAt), now)

describe('prototypeCard', () => {
  it('gives every state the plan line and the mockup eyebrow', () => {
    expect(prototypeStates.map((state) => cardAt(state).eyebrow)).toEqual(['Free days', 'Free days', 'Paid', 'Payment failed', 'Plan stopped', 'Shop closed'])
    for (const state of prototypeStates) expect(cardAt(state).plan).toBe('Mithra Social Starter · ₹299 / month')
  })

  it('offers AutoPay at the trial end during free days, with the ₹5 authorisation disclosed', () => {
    const free = cardAt('free_days')
    expect(free.figure).toEqual({ days: 12 })
    expect(free.body).toBe('Your shop is live for 14 free days. After that, subscribe with Razorpay — ₹299 each month — to keep it open.')
    expect(free.action?.label).toBe('Set up AutoPay · ₹299 on 6 Oct')
    expect(free.action?.help).toBe('Opens Razorpay Checkout. Your card is checked with a refundable ₹5 charge now; the first ₹299 is charged on 6 Oct, when free days end.')
    const three = cardAt('three_days_left')
    expect(three.figure).toEqual({ days: 3 })
    expect(three.tone).toBe('danger')
    expect(three.action?.label).toBe('Set up AutoPay · ₹299 on 27 Sept')
  })

  it('labels Paid as a sample with its paid-until date and no payment button', () => {
    const paid = cardAt('paid')
    expect(paid.figure).toEqual({ headline: 'Shop is open' })
    expect(paid.body).toBe('You paid ₹299 via Razorpay. Shop stays open until 24 Oct. Next month is another ₹299.')
    expect(paid.sample).toMatch(/^Sample: .*no Razorpay payment was taken/)
    expect(paid.action).toBeNull()
  })

  it('asks for an immediate ₹299 when the shop is hidden', () => {
    for (const state of ['payment_failed', 'shop_closed'] as const) {
      const card = cardAt(state)
      expect(card.figure).toEqual({ headline: 'Shop is hidden' })
      expect(card.tone).toBe('danger')
      expect(card.action).toEqual({ label: 'Pay ₹299 with Razorpay', help: 'Opens Razorpay Checkout. Pay by card — about a minute.' })
    }
    expect(cardAt('payment_failed').body).toBe('Customers cannot see your shop. Pay ₹299 with Razorpay to open it again. Old orders are still here.')
    expect(cardAt('shop_closed').body).toBe('Paid days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.')
  })

  it('counts the stopped plan down to its paid-through date', () => {
    const stopped = cardAt('stopped')
    expect(stopped.tone).toBe('warning')
    expect(stopped.figure).toEqual({ days: 8 })
    expect(stopped.body).toBe('You stopped the plan. Shop stays open until 2 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')
    expect(stopped.action?.label).toBe('Keep shop open · ₹299')
    expect(stopped.action?.help).toBe('Opens Razorpay Checkout. Your card is checked with a refundable ₹5 charge now; ₹299 is charged on 2 Oct, when paid days end.')
  })

  it('derives days left from the read time, not the selection time', () => {
    expect(cardAt('free_days', new Date('2026-09-26T10:00:00Z')).figure).toEqual({ days: 10 })
    expect(cardAt('stopped', new Date('2026-10-03T10:00:00Z')).figure).toEqual({ days: 0 })
  })
})

describe('prototypeCard with trial AutoPay on', () => {
  it('keeps the free days, replaces the setup button with the first-fee date and calms the tone', () => {
    for (const state of ['free_days', 'three_days_left'] as const) {
      const seed = prototypeSeed(state, selectedAt)
      const card = prototypeCard(state, seed, selectedAt, seed.trialEndsAt)
      expect(card.eyebrow).toBe('Free days')
      expect(card.figure).toEqual(cardAt(state).figure)
      expect(card.tone).toBe('neutral')
      expect(card.action).toBeNull()
      expect(card.body).toBe('Free days are unchanged. When they end, Razorpay charges ₹299 each month to keep the shop open.')
    }
    const free = prototypeSeed('free_days', selectedAt)
    expect(prototypeCard('free_days', free, selectedAt, free.trialEndsAt).autoPay).toBe('AutoPay on — first ₹299 on 6 Oct')
  })

  it('has no AutoPay note otherwise', () => {
    for (const state of prototypeStates) expect(cardAt(state).autoPay).toBeNull()
    const stopped = prototypeSeed('stopped', selectedAt)
    expect(prototypeCard('stopped', stopped, selectedAt, stopped.paidThrough)).toEqual(cardAt('stopped'))
  })
})

describe('prototypeCard after the first ₹299 is collected during free days', () => {
  const paidThrough = '2026-10-27T18:30:00.000Z'
  const seed = () => ({ ...prototypeSeed('three_days_left', selectedAt), paidThrough })

  it('says the first ₹299 is paid rather than due, keeps the free days and names the next ₹299', () => {
    const card = prototypeCard('three_days_left', seed(), selectedAt, paidThrough, { nextChargeAt: paidThrough })
    expect(card.figure).toEqual({ days: 3 })
    expect(card.action).toBeNull()
    expect(card.body).toBe('Free days are unchanged. The first ₹299 is already paid, so the shop stays open after they end.')
    expect(card.autoPay).toBe('AutoPay on — first ₹299 paid, shop open until 27 Oct. Next ₹299 on 28 Oct.')
    expect(prototypeBanner('three_days_left', seed(), selectedAt, paidThrough, true)).toEqual({
      tone: 'neutral', lead: '3 free days left', text: 'the first ₹299 is already paid, so the shop stays open until 27 Oct.', action: 'Shop plan' })
  })

  it('says no more ₹299 is charged once AutoPay stops, keeping the paid days', () => {
    expect(prototypeCard('free_days', seed(), selectedAt, null, { nextChargeAt: null, stopScheduled: true }).autoPay)
      .toBe('First ₹299 paid, shop open until 27 Oct. AutoPay is off, so no more ₹299 is charged.')
  })
})

describe('prototypeCard after a ₹299 Razorpay Test confirmed', () => {
  it('drops the sample label and states the provider period and next ₹299', () => {
    // As in the hosted run: Razorpay ends the first cycle at IST midnight, so 23 Oct is the last paid day.
    const seed = { ...prototypeSeed('paid', selectedAt), paidThrough: '2026-10-23T18:30:00.000Z' }
    const paid = prototypeCard('paid', seed, selectedAt, null, { nextChargeAt: '2026-10-23T18:30:00.000Z' })
    expect(paid.figure).toEqual({ headline: 'Shop is open' })
    expect(paid.sample).toBeNull()
    expect(paid.body).toBe('You paid ₹299 via Razorpay. Shop stays open until 23 Oct. Next ₹299 is charged on 24 Oct.')
    expect(paid.action).toBeNull()
  })

  // Free days with a collected first ₹299 have their own copy, tested above.
  it('leaves the pay-now states as seeded', () => {
    for (const state of prototypeStates.filter((item) => item === 'payment_failed' || item === 'shop_closed')) {
      expect(prototypeCard(state, prototypeSeed(state, selectedAt), selectedAt, null, { nextChargeAt: '2026-10-24T18:30:00.000Z' })).toEqual(cardAt(state))
    }
  })
})

describe('prototypeCard after Stop the plan or Keep shop open', () => {
  it("says a real plan's Stopped comes from the helper's record of Razorpay Test accepting the stop", () => {
    const seed = { ...prototypeSeed('stopped', selectedAt), paidThrough: '2026-10-23T18:30:00.000Z' }
    expect(prototypeCard('stopped', seed, selectedAt).sample).toBeNull()
    // Once Keep shop open has closed the stopped subscription, a dismissed Checkout still says where Stopped stands.
    expect(prototypeCard('stopped', seed, selectedAt, null, { nextChargeAt: null }).sample).toBe('Razorpay Test shows the stopped subscription cancelled. The days you already paid for are kept.')
    const stopped = prototypeCard('stopped', seed, selectedAt, null, { nextChargeAt: null, stopScheduled: true })
    expect(stopped.body).toBe('You stopped the plan. Shop stays open until 23 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')
    expect(stopped.sample).toBe('Razorpay Test accepted a stop at the end of the paid days. Its reads cannot show a scheduled stop, so this comes from the local helper\'s record of that acceptance.')
    expect(stopped.action?.label).toBe('Keep shop open · ₹299')
  })

  it('says AutoPay ended outside MithraDirect when Razorpay Test closed Paid without Stop the plan', () => {
    const paidThrough = '2026-10-23T18:30:00.000Z'
    const seed = { ...prototypeSeed('payment_failed', selectedAt), paidThrough }
    seed.events.push({ kind: 'paid', at: '2026-09-24T10:00:00.000Z', amountMinor: 29900, paidThrough }, { kind: 'autopay_ended', at: '2026-09-25T10:00:00.000Z', paidThrough })
    const ended = prototypeCard('stopped', seed, selectedAt, null, { nextChargeAt: null })
    expect(ended.eyebrow).toBe('AutoPay ended')
    expect(ended.body).toBe('AutoPay was cancelled outside MithraDirect, so no more ₹299 is charged. Shop stays open until 23 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')
    expect(ended.sample).toBe('Razorpay Test shows the subscription cancelled, but not from this page — for example by the card issuer. The days you already paid for are kept.')
    expect(ended.action?.label).toBe('Keep shop open · ₹299')
    expect(prototypeHistory(seed, new Date('2026-09-25T12:00:00Z'))[0]).toEqual({ title: 'AutoPay ended', detail: 'Cancelled outside MithraDirect', when: 'Today' })
    // The latest stop decides: a later Stop the plan after Keep shop open reads as the vendor's own.
    seed.events.push({ kind: 'plan_resumed', at: '2026-09-25T11:00:00.000Z', chargeAt: paidThrough }, { kind: 'plan_stopped', at: '2026-09-25T12:00:00.000Z', paidThrough })
    expect(prototypeCard('stopped', seed, selectedAt, null, { nextChargeAt: null }).body).toBe('You stopped the plan. Shop stays open until 23 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')
  })

  it('says Razorpay could not collect ₹299 when the helper ended AutoPay after a halt before paid days ended', () => {
    const paidThrough = '2026-10-23T18:30:00.000Z'
    const seed = { ...prototypeSeed('payment_failed', selectedAt), paidThrough }
    seed.events.push({ kind: 'paid', at: '2026-09-24T10:00:00.000Z', amountMinor: 29900, paidThrough }, { kind: 'autopay_ended', at: '2026-09-25T10:00:00.000Z', paidThrough, reason: 'halted' })
    const ended = prototypeCard('stopped', seed, selectedAt, null, { nextChargeAt: null })
    expect(ended.eyebrow).toBe('AutoPay ended')
    expect(ended.body).toBe('Razorpay could not collect ₹299, so AutoPay ended. Shop stays open until 23 Oct. Pay ₹299 with Razorpay if you want to keep it after that.')
    expect(ended.sample).toBe('Razorpay Test halted collection after every retry, so the local helper cancelled the subscription. The days you already paid for are kept.')
    expect(prototypeHistory(seed, new Date('2026-09-25T12:00:00Z'))[0]).toEqual({ title: 'AutoPay ended', detail: 'Payment could not be collected', when: 'Today' })
  })

  it('shows only that the shop is open while Razorpay retries past the boundary, with no date, countdown or banner', () => {
    for (const state of ['paid', 'free_days', 'three_days_left'] as const) {
      const seed = prototypeSeed(state, selectedAt)
      const card = prototypeCard(state, seed, selectedAt, seed.paidThrough ?? seed.trialEndsAt, null, true)
      expect(card).toMatchObject({ tone: 'neutral', figure: { headline: 'Shop is open' }, body: 'AutoPay on.', action: null, autoPay: null, sample: null })
      expect(prototypeBanner(state, seed, selectedAt, seed.trialEndsAt, false, true)).toBeNull()
    }
    // A hidden shop is never shown as retrying.
    expect(prototypeCard('payment_failed', prototypeSeed('payment_failed', selectedAt), selectedAt, null, null, true).figure).toEqual({ headline: 'Shop is hidden' })
  })

  it('keeps the sample Paid labelled but names the next ₹299 once Keep shop open set up AutoPay', () => {
    const seed = prototypeSeed('paid', selectedAt)
    const paid = prototypeCard('paid', seed, selectedAt, seed.paidThrough)
    expect(paid.body).toBe('You paid ₹299 via Razorpay. Shop stays open until 24 Oct. Next ₹299 is charged on 24 Oct.')
    expect(paid.sample).toBe('Sample: the paid days are seeded, so no ₹299 was taken. AutoPay for the next ₹299 is set up with Razorpay Test.')
    expect(paid.autoPay).toBeNull()
  })
})

describe('paid-through dates at IST midnight', () => {
  it('name the last paid day, while the next charge keeps its own day', () => {
    const at = '2026-10-23T18:30:00.000Z'
    const history = prototypeHistory({ ...prototypeSeed('paid', selectedAt), events: [{ kind: 'paid', at: '2026-09-24T13:22:43.000Z', amountMinor: 29900, paidThrough: at }] }, selectedAt)
    expect(history[0].detail).toBe('Shop open until 23 Oct')
    expect(prototypeBanner('stopped', { ...prototypeSeed('stopped', selectedAt), paidThrough: at }, selectedAt)?.lead).toBe('Shop stays open until 23 Oct')
  })
})

describe('prototypeBanner', () => {
  it('gives every state but Paid its banner copy, tone and Plan button', () => {
    expect(bannerAt('free_days')).toEqual({ tone: 'neutral', lead: '12 free days left', text: 'after that, subscribe with Razorpay (₹299 / month) to keep the shop open.', action: 'Pay ₹299' })
    expect(bannerAt('three_days_left')).toEqual({ tone: 'danger', lead: '3 free days left', text: 'set up AutoPay now so customers can still open your shop when free days end.', action: 'Pay ₹299' })
    expect(bannerAt('paid')).toBeNull()
    expect(bannerAt('payment_failed')).toEqual({ tone: 'danger', lead: 'Shop is hidden from customers', text: 'last Razorpay payment did not go through. Pay ₹299 to open the shop again.', action: 'Pay ₹299' })
    expect(bannerAt('stopped')).toEqual({ tone: 'warning', lead: 'Shop stays open until 2 Oct', text: 'then customers cannot see it. You can pay again any time with Razorpay.', action: 'Keep open · ₹299' })
    expect(bannerAt('shop_closed')).toEqual({ tone: 'danger', lead: 'Shop is hidden from customers', text: 'pay ₹299 with Razorpay to open it again.', action: 'Pay ₹299' })
  })

  it('says AutoPay is on during free days once it is set up', () => {
    const seed = prototypeSeed('three_days_left', selectedAt)
    expect(prototypeBanner('three_days_left', seed, selectedAt, seed.trialEndsAt)).toEqual(
      { tone: 'neutral', lead: '3 free days left', text: 'AutoPay is on, so the first ₹299 is charged on 27 Sept.', action: 'Shop plan' })
  })

  it('counts free days from the read time, in the singular at one', () => {
    expect(bannerAt('three_days_left', new Date('2026-09-26T10:00:00Z'))?.lead).toBe('1 free day left')
  })
})

describe('prototypeHistory', () => {
  const rows = (state: State, now?: Date) => historyAt(state, now).map(({ title, detail, when }) => `${title} · ${detail} · ${when}`)

  it("lists each state's seeded rows newest first, as in its mockup", () => {
    expect(rows('free_days')).toEqual(['Free days started · 14 free days · 2 days ago'])
    expect(rows('three_days_left')).toEqual(['Free days started · 14 free days · 11 days ago'])
    expect(rows('paid')).toEqual(['Paid ₹299 · Shop open until 24 Oct · Today', 'Free days started · 14 free days · 14 days ago'])
    expect(rows('payment_failed')).toEqual([
      'Payment did not go through · Shop hidden from customers · Today', 'AutoPay on · First ₹299 on 21 Sept · 8 days ago', 'Free days started · 14 free days · 17 days ago',
    ])
    expect(rows('stopped')).toEqual(['Plan stopped · Shop stays open until paid days end · Today', 'Paid ₹299 · Shop open until 2 Oct · 22 days ago'])
    expect(rows('shop_closed')).toEqual(['Plan stopped · Paid days ended · 2 days ago', 'Paid ₹299 · One month · Last month'])
  })

  it('dates rows from the read time, so they age with the helper clock', () => {
    expect(rows('stopped', new Date('2026-10-05T10:00:00Z'))).toEqual(['Plan stopped · Paid days ended · 11 days ago', 'Paid ₹299 · One month · Last month'])
  })

  it('shows rows appended after the seed', () => {
    const seed = prototypeSeed('free_days', selectedAt)
    seed.events.push({ kind: 'paid', at: '2026-09-24T12:00:00.000Z', amountMinor: 29900, paidThrough: '2026-10-24T12:00:00.000Z' })
    expect(prototypeHistory(seed, selectedAt).map((row) => row.title)).toEqual(['Paid ₹299', 'Free days started'])
  })

  it('shows trial AutoPay being set up and turned off, newest first even within the same minute', () => {
    const seed = prototypeSeed('free_days', selectedAt)
    seed.events.push({ kind: 'autopay_on', at: '2026-09-24T10:00:00.000Z', chargeAt: seed.trialEndsAt }, { kind: 'autopay_off', at: '2026-09-24T10:00:00.000Z' })
    expect(prototypeHistory(seed, selectedAt).map(({ title, detail, when }) => `${title} · ${detail} · ${when}`)).toEqual([
      'AutoPay turned off · Cancelled with Razorpay · Today', 'AutoPay on · First ₹299 on 6 Oct · Today', 'Free days started · 14 free days · 2 days ago'])
  })
})

describe('prototypeHistory after Keep shop open', () => {
  it('shows the stop and the AutoPay set up again, newest first', () => {
    const seed = prototypeSeed('stopped', selectedAt)
    seed.events.push({ kind: 'plan_resumed', at: '2026-09-24T10:20:00.000Z', chargeAt: seed.paidThrough! })
    expect(prototypeHistory(seed, selectedAt).map(({ title, detail, when }) => `${title} · ${detail} · ${when}`)).toEqual([
      'AutoPay set up again · Next ₹299 on 2 Oct · Today', 'Plan stopped · Shop stays open until paid days end · Today', 'Paid ₹299 · Shop open until 2 Oct · 22 days ago'])
  })
})

describe('relativeDay', () => {
  it('counts calendar days in India time', () => {
    const now = new Date('2026-09-24T10:00:00Z') // 15:30 IST
    expect(relativeDay('2026-09-24T00:00:00Z', now)).toBe('Today') // 05:30 IST
    expect(relativeDay('2026-09-23T18:00:00Z', now)).toBe('Yesterday') // 23:30 IST the day before
    expect(relativeDay('2026-09-23T19:00:00Z', now)).toBe('Today') // 00:30 IST
    expect(relativeDay('2026-09-10T10:00:00Z', now)).toBe('14 days ago')
    expect(relativeDay('2026-08-27T10:00:00Z', now)).toBe('Last month')
    expect(relativeDay('2026-07-01T10:00:00Z', now)).toBe('2 months ago')
    expect(relativeDay('2026-09-25T10:00:00Z', now)).toBe('Today')
  })
})
