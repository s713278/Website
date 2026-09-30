import type { BillingSource, VendorBillingStatus } from '../services/vendor-billing.service'
import type { VendorContext } from './vendor-onboarding'

/** Billing rejects missing or ambiguous entitlement without breaking ordinary context hydration. */
export class VendorBillingUnavailableError extends Error {
  constructor(detail = 'Billing status is unavailable. Please refresh and try again.') {
    super(detail)
    this.name = 'VendorBillingUnavailableError'
  }
}

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new VendorBillingUnavailableError()
  return value as RecordValue
}

function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new VendorBillingUnavailableError()
  return value
}

function oneOf<const T extends readonly string[]>(value: unknown, choices: T): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) throw new VendorBillingUnavailableError()
  return value as T[number]
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new VendorBillingUnavailableError()
  return value
}

function nullableInteger(value: unknown): number | null {
  return value === null ? null : integer(value)
}

function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new VendorBillingUnavailableError('Billing dates must include a timezone. Please refresh and try again.')
  return value
}

function nullableDate(value: unknown): string | null {
  return value === null ? null : date(value)
}

function nullableText(value: unknown): string | null {
  if (value === null) return null
  return string(value)
}

export function rupeesToMinorPaise(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new VendorBillingUnavailableError()
  const scaled = value * 100
  const rounded = Math.round(scaled)
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 1e-7) throw new VendorBillingUnavailableError('Billing amount cannot be represented in paise.')
  return rounded
}

function setupPendingReason(context: VendorContext, accessStatus: VendorBillingStatus['accessStatus']): VendorBillingStatus['setupPendingReason'] {
  if (accessStatus !== 'SETUP_INCOMPLETE') return null
  if (context.onboarding.status === 'UNKNOWN' || !['APPROVED', 'PENDING', 'REJECTED'].includes(context.approvalStatus ?? '')) {
    throw new VendorBillingUnavailableError()
  }
  const onboarding = context.onboarding.status !== 'COMPLETED' || (context.onboarding.nextStep !== null && context.onboarding.nextStep < 11)
  const approval = context.approvalStatus !== 'APPROVED'
  if (!onboarding && !approval) throw new VendorBillingUnavailableError()
  return onboarding && approval ? 'both' : onboarding ? 'onboarding' : 'approval'
}

/** Maps the proposed billing addition while retaining existing vendor, plan and feature semantics. */
export function mapVendorBillingStatus(context: VendorContext, source: BillingSource, selectedVendorId: string): VendorBillingStatus {
  if (context.vendorId !== selectedVendorId) throw new VendorBillingUnavailableError('Billing was returned for a different vendor. Please refresh.')
  const billing = record(context.billing)
  const serverTime = date(context.serverTime)
  if (context.billingCapabilitiesValid !== true) throw new VendorBillingUnavailableError()
  const accessStatus = oneOf(billing.access_status, ['TRIAL', 'TRIAL_ENDED', 'PAID', 'PAYMENT_REQUIRED', 'SETUP_INCOMPLETE'] as const)
  const trialStatus = oneOf(billing.trial_status, ['not_started', 'active', 'ended', 'ineligible'] as const)
  const trialEndsAt = nullableDate(context.subscription.trialEndsAt)
  const daysRemaining = nullableInteger(billing.trial_days_remaining)
  if (trialStatus === 'active' && (trialEndsAt === null || daysRemaining === null)) throw new VendorBillingUnavailableError()
  if (typeof billing.store_visible !== 'boolean') throw new VendorBillingUnavailableError()
  if (!Array.isArray(billing.available_actions)) throw new VendorBillingUnavailableError()
  const availableActions = billing.available_actions.map((action) => oneOf(action, ['setup_autopay', 'pay_first_fee', 'cancel'] as const))
  if (accessStatus === 'SETUP_INCOMPLETE' && (trialStatus !== 'not_started' || availableActions.length > 0 || trialEndsAt !== null)) {
    throw new VendorBillingUnavailableError()
  }
  const cancellation = billing.cancellation === null ? null : (() => {
    const value = record(billing.cancellation)
    return {
      status: oneOf(value.status, ['requested', 'scheduled', 'confirmed', 'failed'] as const),
      requestedAt: nullableDate(value.requested_at),
      effectiveAt: nullableDate(value.effective_at),
    }
  })()
  const refund = billing.refund === null ? null : (() => {
    const value = record(billing.refund)
    return { status: oneOf(value.status, ['owed', 'pending', 'completed', 'failed'] as const), amountMinor: rupeesToMinorPaise(value.amount) }
  })()
  if (context.subscription.currency !== 'INR') throw new VendorBillingUnavailableError()

  return {
    vendorId: context.vendorId,
    source,
    serverTime,
    revision: integer(billing.revision),
    plan: {
      code: string(context.subscription.tier),
      name: string(context.subscription.planName),
      amountMinor: rupeesToMinorPaise(context.subscription.monthlyPrice),
      currency: 'INR',
      interval: 'month',
    },
    setupPendingReason: setupPendingReason(context, accessStatus),
    trial: { status: trialStatus, endsAt: trialEndsAt, daysRemaining },
    authorisation: { status: oneOf(billing.autopay_status, ['not_configured', 'pending', 'confirmed', 'failed', 'revoked'] as const) },
    membership: {
      paymentStatus: oneOf(billing.payment_status, ['none', 'pending', 'confirmed', 'failed'] as const),
      paidThrough: nullableDate(billing.paid_through),
      nextChargeAt: nullableDate(billing.next_charge_at),
    },
    cancellation,
    refund,
    notice: nullableText(billing.notice),
    accessStatus,
    capabilities: context.eligibleFeatures,
    storeVisible: billing.store_visible,
    availableActions,
  }
}
