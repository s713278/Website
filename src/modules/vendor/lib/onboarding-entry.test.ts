import { describe, expect, it } from 'vitest'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import { resumePathAfterLogin, vendorLandingPath } from '@/app/router/role-home'
import type { User } from '@/shared/types'
import { resolveOnboardingEntry } from './onboarding-entry'
import { resumeStep, type ServerOnboardingState } from './onboarding-resume'

type Context = ServerOnboardingState['context']

function state(
  vendorStatus: string,
  approvalStatus: string,
  saved: Partial<ServerOnboardingState> = {},
): ServerOnboardingState {
  const context: Context = {
    vendorId: '91',
    businessName: 'SK Organic Store',
    storeIdentifier: vendorStatus === 'ACTIVE' ? 'sk-organic-store' : null,
    vendorStatus,
    approvalStatus,
    membershipRole: 'OWNER',
    onboarding: vendorStatus === 'ACTIVE'
      ? { status: 'COMPLETED', description: null, nextStep: 11 }
      : { status: 'IN_PROGRESS', description: 'Step 5 is completed', nextStep: 5 },
    subscription: {
      tier: 'SILVER',
      planName: 'Silver',
      status: 'TRIAL',
      currency: 'INR',
      monthlyPrice: 999,
      yearlyPrice: 9999,
      trialEndsAt: null,
      trialDays: null,
      limits: { maxCategories: 10, maxProducts: 50, maxSkus: 100, maxImages: 50 },
      usage: { categories: 1, products: 1, skus: 1, images: 0 },
    },
    eligibleFeatures: [],
  }
  return {
    context,
    profile: {
      businessName: 'SK Organic Store',
      businessType: 'Beverages & Juice Center',
      ownerName: 'Sanjay Kumar',
      contactPerson: 'Sanjay Kumar',
      contactNumber: '9876543210',
    },
    categories: [{ vendorCategoryId: 501, platformCategoryId: 10, name: 'Juices', imageUrl: null }],
    products: [{ vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Orange Juice', measurementId: 2 }],
    skus: [{
      vendorProductId: 900, skuId: 4021, priceId: 8021, name: 'Orange Juice-1 L', size: '1 L',
      displayName: 'Orange Juice', description: '', isActive: true,
      listPrice: 180, salePrice: 160, quantity: 1, unit: 'L',
    }],
    checkout: {
      fulfillmentType: 'HOME_DELIVERY',
      schedulingStrategy: 'FIXED_WINDOW',
      schedulingConfig: {},
      shippingConfig: { deliveryCharge: 25, freeDeliveryThreshold: 0 },
      slots: [],
      consentTitle: '',
      consentText: '',
      payments: [{ type: 'CASH_ON_DELIVERY', isDefault: true, details: {} }],
    },
    businessTypes: [{ id: 7, name: 'Beverages & Juice Center', icon: null, displayOrder: 1 }],
    measurements: SAMPLE_MEASUREMENT_CATALOG,
    productMeasurementCatalog: SAMPLE_MEASUREMENT_CATALOG,
    ...saved,
  }
}

const vendor: User = {
  id: '1',
  name: 'Sanjay Kumar',
  email: '',
  role: 'vendor',
  roles: ['vendor'],
  vendorId: '91',
  vendors: [{ vendorId: '91', name: 'SK Organic Store' }],
}

describe('resolveOnboardingEntry', () => {
  it('resumes an active approved vendor whose onboarding is still at Step 7', () => {
    const unfinished = state('ACTIVE', 'APPROVED')
    unfinished.context.onboarding = { status: 'IN_PROGRESS', nextStep: 7, description: 'Step 6: Set Prices' }

    expect(vendorLandingPath(resolveOnboardingEntry(unfinished))).toBe('/onboarding')
    expect(resumeStep(unfinished)).toBe(7)
  })

  it('reports a submitted store awaiting approval as submitted', () => {
    expect(resolveOnboardingEntry(state('ACTIVE', 'PENDING'))).toEqual({ kind: 'submitted' })
  })

  it('keeps an approved store in the submitted route state', () => {
    expect(resolveOnboardingEntry(state('ACTIVE', 'APPROVED'))).toEqual({ kind: 'submitted' })
  })

  it.each(['PENDING', 'APPROVED'])('resumes unfinished onboarding despite active status and %s approval', (approval) => {
    const unfinished = state('ACTIVE', approval)
    unfinished.context.onboarding = { status: 'IN_PROGRESS', description: null, nextStep: 5 }
    expect(resolveOnboardingEntry(unfinished).kind).toBe('resume')
    expect(resumeStep(unfinished)).toBe(5)
  })

  it('keeps an active store in setup when only its status reports incomplete onboarding', () => {
    const unfinished = state('ACTIVE', 'APPROVED')
    unfinished.context.onboarding = { status: 'IN_PROGRESS', description: null, nextStep: null }
    expect(resolveOnboardingEntry(unfinished).kind).toBe('resume')
  })

  it('uses completion status when the resume pointer is missing', () => {
    const finished = state('ACTIVE', 'APPROVED')
    finished.context.onboarding.nextStep = null
    expect(resolveOnboardingEntry(finished).kind).toBe('submitted')
  })

  it('keeps legacy activation as a fallback only when onboarding evidence is absent', () => {
    const legacy = state('ACTIVE', 'PENDING')
    legacy.context.onboarding = { status: 'UNKNOWN', description: null, nextStep: null }
    expect(resolveOnboardingEntry(legacy).kind).toBe('submitted')
  })

  it('resumes an unfinished store at its first unsaved step', () => {
    expect(resolveOnboardingEntry(state('INACTIVE', 'PENDING', { skus: [] }))).toEqual({ kind: 'resume' })
  })

  it('starts a brand-new vendor at Step 3', () => {
    const fresh = state('INACTIVE', 'PENDING', {
      categories: [], products: [], skus: [], checkout: null,
    })
    fresh.profile = { ...fresh.profile!, businessType: 'Others' }
    expect(resolveOnboardingEntry(fresh)).toEqual({ kind: 'resume' })
  })
})

describe('vendorLandingPath', () => {
  it('sends a submitted store to the dashboard, never back into setup', () => {
    expect(vendorLandingPath(resolveOnboardingEntry(state('ACTIVE', 'PENDING')))).toBe('/vendor')
    expect(vendorLandingPath(resolveOnboardingEntry(state('ACTIVE', 'APPROVED')))).toBe('/vendor')
  })

  it('sends an unfinished store to the wizard', () => {
    expect(vendorLandingPath(resolveOnboardingEntry(state('INACTIVE', 'PENDING')))).toBe('/onboarding')
  })

  it('falls back to setup when the account could not be read', () => {
    expect(vendorLandingPath(null)).toBe('/onboarding')
  })
})

describe('resumePathAfterLogin', () => {
  it('routes a signed-in vendor by their account state', () => {
    expect(resumePathAfterLogin(vendor, null, resolveOnboardingEntry(state('ACTIVE', 'PENDING')))).toBe('/vendor')
    expect(resumePathAfterLogin(vendor, null, resolveOnboardingEntry(state('INACTIVE', 'PENDING')))).toBe('/onboarding')
  })

  it('still honours an explicit customer destination for a dual-role user', () => {
    const dual: User = { ...vendor, role: 'customer', roles: ['customer', 'vendor'] }
    expect(resumePathAfterLogin(dual, '/checkout')).toBe('/checkout')
  })

  it('sends a dual-role user with no destination to their store when setup is unfinished', () => {
    const dual: User = { ...vendor, role: 'customer', roles: ['customer', 'vendor'] }
    expect(resumePathAfterLogin(dual, null, resolveOnboardingEntry(state('INACTIVE', 'PENDING')))).toBe('/onboarding')
  })
})
