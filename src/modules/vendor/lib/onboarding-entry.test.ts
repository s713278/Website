import { describe, expect, it } from 'vitest'
import { resumePathAfterLogin, vendorLandingPath } from '@/app/router/role-home'
import type { User } from '@/shared/types'
import { resolveOnboardingEntry } from './onboarding-entry'
import type { ServerOnboardingState } from './onboarding-resume'

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
    // Deliberately claims IN_PROGRESS even when live — the backend really does this.
    onboarding: { status: 'IN_PROGRESS', description: 'Step 5 is completed', nextStep: 5 },
    subscription: {
      tier: 'SILVER',
      planName: 'Silver',
      status: 'TRIAL',
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
      vendorProductId: 900, skuId: 4021, name: 'Orange Juice-1 L', size: '1 L',
      displayName: 'Orange Juice', description: '', isActive: true,
      listPrice: 180, salePrice: 160, quantity: 1, unit: 'L',
    }],
    checkout: {
      fulfillmentType: 'HOME_DELIVERY',
      orderAcceptancePolicy: 'AUTO_ACCEPT',
      schedulingStrategy: 'FIXED_WINDOW',
      schedulingConfig: {},
      shippingConfig: { deliveryCharge: 25, freeDeliveryThreshold: 0 },
      slots: [],
      consentTitle: '',
      consentText: '',
      payments: [{ type: 'CASH_ON_DELIVERY', isDefault: true, details: {} }],
    },
    businessTypes: [{ id: 7, name: 'Beverages & Juice Center', icon: null, displayOrder: 1 }],
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
  it('treats a submitted store awaiting approval as complete', () => {
    expect(resolveOnboardingEntry(state('ACTIVE', 'PENDING'))).toEqual({ kind: 'complete' })
  })

  it('treats an approved store as complete', () => {
    expect(resolveOnboardingEntry(state('ACTIVE', 'APPROVED'))).toEqual({ kind: 'complete' })
  })

  it('ignores the backend onboarding block, which reports IN_PROGRESS even when live', () => {
    const live = state('ACTIVE', 'PENDING')
    expect(live.context.onboarding.status).toBe('IN_PROGRESS')
    expect(live.context.onboarding.nextStep).toBe(5)
    expect(resolveOnboardingEntry(live).kind).toBe('complete')
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
  it('sends a completed store to the dashboard, never back into setup', () => {
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
