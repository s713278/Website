import { describe, expect, it } from 'vitest'
import fixtures from '../../../../docs/examples/vendor-billing/mock-responses.json'
import { mapVendorContext } from './vendor-onboarding'
import { mapVendorBillingStatus, rupeesToMinorPaise, VendorBillingUnavailableError } from './vendor-billing'

describe('proposed vendor billing mapper', () => {
  it('maps every supplied billing context through the real vendor context mapper', () => {
    for (const [scenario, payload] of Object.entries(fixtures.contexts)) {
      const context = mapVendorContext(payload)
      if (scenario === 'current_context') {
        expect(context.billing).toBeNull()
        expect(context.subscription.usage.products).toBe(5)
        expect(() => mapVendorBillingStatus(context, 'mock', context.vendorId)).toThrow(VendorBillingUnavailableError)
        continue
      }
      const status = mapVendorBillingStatus(context, 'mock', context.vendorId)
      expect(status.vendorId).toBe(context.vendorId)
      expect(status.source).toBe('mock')
      expect(status.plan.amountMinor).toBe(29900)
      expect(status.capabilities).toEqual(context.eligibleFeatures)
    }
    expect(Object.keys(fixtures.contexts)).toHaveLength(33)
  })

  it('uses service-owned trial days and keeps the original expiry after setup', () => {
    const active = mapVendorBillingStatus(mapVendorContext(fixtures.contexts.trial_active), 'preview', '900001')
    const confirmed = mapVendorBillingStatus(mapVendorContext(fixtures.contexts.setup_confirmed), 'preview', '900001')
    expect(active.trial).toEqual({ status: 'active', endsAt: '2026-10-15T10:00:00Z', daysRemaining: 10 })
    expect(confirmed.trial).toEqual(active.trial)
    expect(confirmed.authorisation.status).toBe('confirmed')
    expect(confirmed.membership.paymentStatus).toBe('none')
    expect(confirmed.membership.nextChargeAt).toBe(active.trial.endsAt)
    expect(confirmed.accessStatus).toBe('TRIAL')
  })

  it('keeps the 24 September lifecycle shape unavailable until its billing additions ship', () => {
    const context = mapVendorContext({
      timestamp: '2026-09-24T11:24:25.634565923Z',
      data: {
        vendor_id: 900001,
        vendor_status: 'ACTIVE',
        approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED' },
        subscription: {
          lifecycle_status: 'TRIAL_ACTIVE',
          trial: { ends_at: '2026-10-08T03:16:30.397Z', days_total: 14, days_remaining: 13, expired: false },
          plan: { plan_code: 'SOCIAL_STARTER_TRIAL', plan_name: 'Social Starter Trial', currency: 'INR' },
        },
        features: ['STOREFRONT'],
      },
    })
    expect(context.subscription.trialEndsAt).toBe('2026-10-08T03:16:30.397Z')
    expect(() => mapVendorBillingStatus(context, 'backend', '900001')).toThrow(VendorBillingUnavailableError)
  })

  it('converts rupees to exact integer paise', () => {
    expect(rupeesToMinorPaise(299.99)).toBe(29999)
    expect(rupeesToMinorPaise(5.5)).toBe(550)
    expect(() => rupeesToMinorPaise(0.001)).toThrow(VendorBillingUnavailableError)
  })

  it('rejects missing or ambiguous entitlement while leaving ordinary context usable', () => {
    const base = structuredClone(fixtures.contexts.trial_active)
    const wrongVendor = mapVendorContext(base)
    expect(() => mapVendorBillingStatus(wrongVendor, 'mock', '900002')).toThrow(VendorBillingUnavailableError)

    const missingAccess = structuredClone(base) as typeof base
    delete (missingAccess.data.subscription.billing as Record<string, unknown>).access_status
    expect(() => mapVendorBillingStatus(mapVendorContext(missingAccess), 'mock', '900001')).toThrow(VendorBillingUnavailableError)

    const unknownAccess = structuredClone(base)
    ;(unknownAccess.data.subscription.billing as Record<string, unknown>).access_status = 'GRACE'
    expect(() => mapVendorBillingStatus(mapVendorContext(unknownAccess), 'mock', '900001')).toThrow(VendorBillingUnavailableError)

    const noFeatures = structuredClone(base)
    delete (noFeatures.data as Record<string, unknown>).eligible_features
    expect(() => mapVendorBillingStatus(mapVendorContext(noFeatures), 'mock', '900001')).toThrow(VendorBillingUnavailableError)
    expect(mapVendorContext(noFeatures).subscription.usage.products).toBe(5)
  })

  it('refuses timezone-free billing dates and envelope timestamps', () => {
    const noOffset = structuredClone(fixtures.contexts.trial_active)
    noOffset.timestamp = '2026-10-05T10:00:00'
    expect(() => mapVendorBillingStatus(mapVendorContext(noOffset), 'mock', '900001')).toThrow(/timezone/)
    const noTrialOffset = structuredClone(fixtures.contexts.trial_active)
    noTrialOffset.data.subscription.trial_ends_at = '2026-10-15T10:00:00'
    expect(() => mapVendorBillingStatus(mapVendorContext(noTrialOffset), 'mock', '900001')).toThrow(/timezone/)
  })

  it('derives both setup blockers from genuine onboarding and approval data', () => {
    const both = structuredClone(fixtures.contexts.setup_incomplete)
    both.data.approval_status = 'PENDING'
    const status = mapVendorBillingStatus(mapVendorContext(both), 'mock', '900001')
    expect(status.setupPendingReason).toBe('both')
    expect(status.trial.endsAt).toBeNull()
    expect(status.availableActions).toEqual([])
    const missingApproval = structuredClone(both)
    delete (missingApproval.data as Record<string, unknown>).approval_status
    expect(() => mapVendorBillingStatus(mapVendorContext(missingApproval), 'mock', '900001')).toThrow(VendorBillingUnavailableError)
    const unknownOnboarding = structuredClone(both)
    unknownOnboarding.data.onboarding.status = 'MISSING'
    expect(() => mapVendorBillingStatus(mapVendorContext(unknownOnboarding), 'mock', '900001')).toThrow(VendorBillingUnavailableError)
  })

  it('keeps legacy plan tier and fractional refund amounts separate from billing access', () => {
    const active = mapVendorBillingStatus(mapVendorContext(fixtures.contexts.trial_active), 'demo', '900001')
    expect(active.plan.code).toBe('FREE')
    expect(active.accessStatus).toBe('TRIAL')
    expect(active.source).toBe('demo')
    const refund = structuredClone(fixtures.contexts.refund_owed)
    refund.data.subscription.billing.refund!.amount = 5.5
    expect(mapVendorBillingStatus(mapVendorContext(refund), 'mock', '900001').refund?.amountMinor).toBe(550)
  })
})
