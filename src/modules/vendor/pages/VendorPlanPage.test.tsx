// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { VendorPlanPage } from './VendorPlanPage'

afterEach(cleanup)

const account: VendorAccount = {
  vendorId: 'vendor-1',
  context: {
    vendorId: 'vendor-1',
    businessName: 'Test Store',
    storeIdentifier: null,
    vendorStatus: 'ACTIVE',
    approvalStatus: 'APPROVED',
    membershipRole: 'OWNER',
    onboarding: { status: 'COMPLETED', description: null, nextStep: 11 },
    subscription: {
      tier: 'FREE',
      planName: 'Free',
      status: 'ACTIVE',
      currency: 'INR',
      monthlyPrice: 0,
      yearlyPrice: 0,
      trialEndsAt: null,
      trialDays: 0,
      limits: { maxCategories: 3, maxProducts: 10, maxSkus: 25, maxImages: 10 },
      usage: { categories: 1, products: 1, skus: 2, images: 0 },
    },
    eligibleFeatures: ['DASHBOARD', 'VIEW', 'CATALOG'],
  },
  storeState: 'OPEN',
  plan: {
    code: 'FREE',
    name: 'Free',
    status: 'ACTIVE',
    currency: 'INR',
    monthlyPrice: 0,
    yearlyPrice: 0,
    trialEndsAt: null,
    trialDays: 0,
    limits: { categories: 3, products: 10, skus: 25, images: 10 },
    usage: { categories: 1, products: 1, skus: 2, images: 0 },
  },
  reload: () => {},
  demo: null,
}

describe('VendorPlanPage', () => {
  it('shows all usage first, followed by the plan name and status', () => {
    const view = render(
      <VendorAccountContext.Provider value={account}>
        <VendorPlanPage />
      </VendorAccountContext.Provider>,
    )

    expect(screen.getByText('1 of 3 used')).toBeTruthy()
    expect(screen.getByText('1 of 10 used')).toBeTruthy()
    expect(screen.getByText('2 of 25 used')).toBeTruthy()
    expect(screen.getByText('0 of 10 used')).toBeTruthy()

    const text = view.container.textContent ?? ''
    expect(text.indexOf('0 of 10 used')).toBeLessThan(text.indexOf('Plan name'))
    expect(text.indexOf('Plan name')).toBeLessThan(text.indexOf('Status'))
  })

  it('does not turn zero prices or zero trial days into billing claims', () => {
    render(
      <VendorAccountContext.Provider value={account}>
        <VendorPlanPage />
      </VendorAccountContext.Provider>,
    )

    expect(screen.queryByText(/price|monthly|yearly|upgrade|₹|INR/i)).toBeNull()
    expect(screen.queryByText(/trial/i)).toBeNull()
  })

  it('does not present the tier code as a missing plan name', () => {
    render(
      <VendorAccountContext.Provider
        value={{ ...account, plan: { ...account.plan, name: null } }}
      >
        <VendorPlanPage />
      </VendorAccountContext.Provider>,
    )

    expect(screen.getByText('Plan name').parentElement?.textContent).toBe(
      'Plan nameNot available',
    )
  })
})
