// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { invalidateVendorContext, loadVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import {
  mapVendorContext,
  vendorOrdersService,
  vendorSubscriptionsService,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { AppRouter } from './index'

beforeEach(async () => {
  window.history.pushState({}, '', '/vendor/orders/subscriptions')
  invalidateVendorContext()
  useAuthStore.getState().applySession({
    token: 'test-token',
    refreshToken: null,
    user: {
      id: 'test-user',
      name: 'Test Vendor',
      email: 'vendor@example.test',
      role: 'vendor',
      roles: ['vendor'],
      vendors: [{ vendorId: 'vendor-1' }],
      vendorId: 'vendor-1',
    },
  })
  useAuthStore.getState().setHydrated(true)

  await loadVendorContext('vendor-1', async () =>
    mapVendorContext({
      data: {
        vendor_id: 'vendor-1',
        business_name: 'Test Store',
        vendor_status: 'ACTIVE',
        approval_status: 'APPROVED',
        onboarding: { status: 'COMPLETED', next_step: 11 },
      },
    }),
  )
})

afterEach(() => {
  cleanup()
  invalidateVendorContext()
  useAuthStore.getState().clearSession()
  useAuthStore.getState().setHydrated(false)
  vi.restoreAllMocks()
})

describe('vendor order routes', () => {
  it('routes the static subscriptions path ahead of order detail and keeps Orders active', async () => {
    vi.spyOn(vendorSubscriptionsService, 'list').mockResolvedValue({
      subscriptions: [],
      page: 0,
      totalPages: 1,
      totalElements: 0,
      lastPage: true,
    })
    const getOrder = vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(null)
    const listOrders = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue({
      orders: [],
      page: 0,
      totalPages: 1,
      totalElements: 0,
      lastPage: true,
    })

    render(<AppRouter />)

    expect(await screen.findByRole('heading', { name: 'Subscriptions' })).toBeTruthy()
    expect(getOrder).not.toHaveBeenCalled()
    expect(screen.queryByText('Order not found')).toBeNull()

    const activeOrderLinks = screen
      .getAllByRole('link', { name: 'Orders' })
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(activeOrderLinks).toHaveLength(2)

    const tabs = screen.getByRole('navigation', { name: 'Orders sections' })
    expect(within(tabs).getByRole('link', { name: 'Subscriptions' }).getAttribute('aria-current'))
      .toBe('page')

    fireEvent.click(within(tabs).getByRole('link', { name: 'Orders' }))

    expect(await screen.findByRole('heading', { name: 'Orders' })).toBeTruthy()
    expect(listOrders).toHaveBeenCalledWith('vendor-1', {
      page: 0,
      status: null,
      startDate: null,
      endDate: null,
    })
  })
})
