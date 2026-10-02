import { afterEach, describe, expect, it } from 'vitest'
import { mapVendorContext, type VendorContext } from '@/shared/api'
import {
  invalidateVendorOnboardingState,
  peekVendorAccountContext,
  writeEntry,
} from './onboarding-state-cache'
import type { ServerOnboardingState } from './onboarding-resume'
import { loadVendorContext } from './vendor-context-cache'

const VENDOR_ID = '96'

afterEach(() => invalidateVendorOnboardingState())

function contextWith(approvalStatus: string): VendorContext {
  return mapVendorContext({
    data: { vendor_id: VENDOR_ID, vendor_status: 'ACTIVE', approval_status: approvalStatus },
  })
}

function resolveWizardRead(context: VendorContext) {
  const state: ServerOnboardingState = {
    context,
    profile: null,
    categories: [],
    products: [],
    skus: [],
    checkout: null,
    businessTypes: [],
    measurements: [],
    productMeasurementCatalog: [],
  }
  writeEntry(VENDOR_ID, { promise: Promise.resolve(state), resolved: state })
}

describe('peekVendorAccountContext', () => {
  it('is null before any account read has resolved', () => {
    expect(peekVendorAccountContext(VENDOR_ID)).toBeNull()
  })

  it('returns the context of the wizard’s resolved read', () => {
    const context = contextWith('PENDING')
    resolveWizardRead(context)

    expect(peekVendorAccountContext(VENDOR_ID)).toBe(context)
  })

  it('prefers the dashboard’s context, which a billing refresh keeps newer than the wizard’s', async () => {
    resolveWizardRead(contextWith('PENDING'))
    const dashboard = contextWith('APPROVED')
    await loadVendorContext(VENDOR_ID, async () => dashboard)

    expect(peekVendorAccountContext(VENDOR_ID)).toBe(dashboard)
  })

  it('does not return a read that is still in flight', () => {
    void loadVendorContext(VENDOR_ID, () => new Promise<VendorContext>(() => {}))

    expect(peekVendorAccountContext(VENDOR_ID)).toBeNull()
  })

  it('is cleared along with the rest of the account on invalidation', () => {
    resolveWizardRead(contextWith('PENDING'))

    invalidateVendorOnboardingState(VENDOR_ID)

    expect(peekVendorAccountContext(VENDOR_ID)).toBeNull()
  })
})
