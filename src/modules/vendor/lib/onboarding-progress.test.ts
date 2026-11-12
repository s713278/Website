import { describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft, createEmptyRuntimeState } from '../data/onboarding-defaults'
import type { OnboardingStep } from '../types/onboarding'
import {
  checkoutWriteInput,
  completedBefore,
  draftMatchesBaseline,
  pendingEditIssues,
  pendingSteps,
  returnStepAfterMove,
  stepAfterSave,
  stepSnapshot,
  type SavedBaselines,
} from './onboarding-progress'

const draft = createEmptyOnboardingDraft()
const runtime = createEmptyRuntimeState()
const savedPayments = draft.payments.map((option) => option.type === 'CASH_ON_DELIVERY'
  ? { ...option, enabled: true, isDefault: true }
  : option)
const saved: SavedBaselines = {
  7: { delivery: draft.delivery },
  8: { payments: savedPayments, paymentDetails: { ...runtime.paymentDetails, upiId: 'shop@upi' } },
  9: stepSnapshot(9, draft, runtime),
}
const withCharge = (charge: number) => ({
  ...draft, delivery: { ...draft.delivery, shipping: { ...draft.delivery.shipping, charge } },
})

describe('pendingSteps', () => {
  const base = { draft: { ...draft, payments: savedPayments }, runtime: { ...runtime, paymentDetails: saved[8]!.paymentDetails }, editedSteps: [], savedBaselines: saved }

  it('reports nothing while every known step matches its saved values', () => {
    expect(pendingSteps(base)).toEqual([])
  })

  it('reports a step that differs from its saved values, and not once it is changed back', () => {
    expect(pendingSteps({ ...base, draft: { ...withCharge(45), payments: savedPayments } })).toEqual([7])
    expect(pendingSteps({ ...base, draft: { ...withCharge(draft.delivery.shipping.charge), payments: savedPayments } })).toEqual([])
  })

  it('counts runtime-only fields, such as payment details, against the baseline', () => {
    const typed = { ...base.runtime, paymentDetails: { ...base.runtime.paymentDetails, upiId: 'other@upi' } }
    expect(pendingSteps({ ...base, runtime: typed })).toEqual([8])
  })

  it('falls back to the edited set for a step with no known baseline', () => {
    expect(pendingSteps({ ...base, editedSteps: [5, 7] })).toEqual([5])
  })

  it('always counts a chosen, unsent image', () => {
    const file = new File(['png'], 'logo.png')
    expect(pendingSteps({ ...base, runtime: { ...base.runtime, logoFile: file } })).toEqual([9])
  })
})

describe('draftMatchesBaseline', () => {
  it('compares only the persisted draft section, not runtime fields', () => {
    expect(draftMatchesBaseline(8, { ...draft, payments: savedPayments }, saved)).toBe(true)
    expect(draftMatchesBaseline(8, draft, saved)).toBe(false)
  })

  it('is unknown without a baseline', () => {
    expect(draftMatchesBaseline(4, draft, saved)).toBeNull()
  })
})

describe('pendingEditIssues', () => {
  it('asks to save or undo each unsaved step, linking to it', () => {
    expect(pendingEditIssues([3, 8])).toEqual([
      { step: 3, field: 'pending-step-3', message: 'Save or undo your changes to business type.' },
      { step: 8, field: 'pending-step-8', message: 'Save or undo your changes to payments.' },
    ])
  })
})

describe('returnStepAfterMove', () => {
  it('remembers the step a vendor goes back from', () => {
    expect(returnStepAfterMove(null, 9, 7)).toBe(9)
  })

  it('keeps it while browsing earlier steps', () => {
    expect(returnStepAfterMove(9, 7, 4)).toBe(9)
    expect(returnStepAfterMove(9, 4, 8)).toBe(9)
  })

  it('forgets it on reaching it or anything past it', () => {
    expect(returnStepAfterMove(9, 7, 9)).toBeNull()
    expect(returnStepAfterMove(9, 8, 10)).toBeNull()
  })

  it('sets nothing moving forward, or around the identity steps', () => {
    expect(returnStepAfterMove(null, 5, 6)).toBeNull()
    expect(returnStepAfterMove(null, 2, 1)).toBeNull()
  })
})

describe('stepAfterSave', () => {
  it('returns to the remembered step, and otherwise moves on', () => {
    expect(stepAfterSave(7, 9)).toBe(9)
    expect(stepAfterSave(7, null)).toBe(8)
    expect(stepAfterSave(9, 9)).toBe(10)
    expect(stepAfterSave(10, null)).toBe(10)
  })
})

describe('completedBefore', () => {
  it('counts every step before the one the account opens on', () => {
    expect(completedBefore(4)).toEqual([1, 2, 3] satisfies OnboardingStep[])
    expect(completedBefore(3)).toEqual([1, 2])
  })
})

describe('checkoutWriteInput', () => {
  const editedPayments = draft.payments.map((option) => ({ ...option, enabled: false }))
  const pending = { ...withCharge(45), payments: editedPayments }
  const typed = { ...runtime, paymentDetails: { ...runtime.paymentDetails, upiId: 'unsaved@upi' } }

  it('sends Step 7 with Step 8’s saved values, never its pending edits', () => {
    const input = checkoutWriteInput(7, pending, typed, saved)!
    expect(input.draft.delivery.shipping.charge).toBe(45)
    expect(input.draft.payments).toEqual(savedPayments)
    expect(input.runtime.paymentDetails.upiId).toBe('shop@upi')
  })

  it('sends Step 8 with Step 7’s saved values', () => {
    const input = checkoutWriteInput(8, pending, typed, saved)!
    expect(input.draft.delivery).toEqual(draft.delivery)
    expect(input.draft.payments).toEqual(editedPayments)
    expect(input.runtime.paymentDetails.upiId).toBe('unsaved@upi')
  })

  it('is unknown until the other step’s saved values are', () => {
    expect(checkoutWriteInput(7, pending, typed, { 7: saved[7] })).toBeNull()
    expect(checkoutWriteInput(8, pending, typed, { 8: saved[8] })).toBeNull()
  })
})
