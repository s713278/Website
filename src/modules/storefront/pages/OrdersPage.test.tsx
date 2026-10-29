// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ordersService, type CustomerOrder } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { OrdersPage } from './OrdersPage'

afterEach(() => {
  cleanup()
  useAuthStore.getState().clearSession()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function order(id: string, storeId = '273'): CustomerOrder {
  return {
    id,
    storeId,
    storeName: 'Shop',
    total: 30,
    status: 'SCHEDULED',
    placedAt: '2026-09-25T00:00:00.000Z',
    items: [{ name: `Item ${id}`, qty: 1 }],
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function signIn() {
  useAuthStore.getState().applySession({
    token: 'synthetic-access-token',
    refreshToken: 'synthetic-refresh-token',
    user: {
      id: '14752',
      name: 'Customer',
      email: 'customer@example.test',
      role: 'customer',
      roles: ['customer'],
      vendors: [],
    },
  })
}

function renderOrders() {
  return render(
    <MemoryRouter initialEntries={['/stores/273/orders']}>
      <Routes>
        <Route path="/stores/:storeId/orders" element={<OrdersPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('OrdersPage pagination', () => {
  it('loads page 0 of history/paged and appends the next page when the list bottom is visible', async () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observers.push(callback)
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
    signIn()
    const list = vi.spyOn(ordersService, 'listMyOrdersPage').mockImplementation(async (_userId, page = 0) => {
      if (page === 0) {
        return {
          orders: [order('1941')],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 2,
          totalPages: 2,
          lastPage: false,
        }
      }
      return {
        orders: [order('1942')],
        pageNumber: 1,
        pageSize: 20,
        totalElements: 2,
        totalPages: 2,
        lastPage: true,
      }
    })

    renderOrders()
    await settle()

    expect(list).toHaveBeenCalledWith('14752', 0)
    expect(screen.getByText('Order #1941')).toBeTruthy()
    expect(screen.queryByText('Order #1942')).toBeNull()

    expect(observers.length).toBeGreaterThan(0)
    await act(async () => {
      observers.at(-1)?.([{ isIntersecting: true }])
      await Promise.resolve()
    })

    expect(list).toHaveBeenCalledWith('14752', 1)
    expect(screen.getByText('Order #1941')).toBeTruthy()
    expect(screen.getByText('Order #1942')).toBeTruthy()
  })

  it('drops a stale first page after the user id changes', async () => {
    signIn()
    const first = deferred<{
      orders: CustomerOrder[]
      pageNumber: number
      pageSize: number
      totalElements: number | null
      totalPages: number | null
      lastPage: boolean
    }>()
    const list = vi.spyOn(ordersService, 'listMyOrdersPage').mockImplementationOnce(() => first.promise)
    list.mockResolvedValue({
      orders: [order('2001')],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
      lastPage: true,
    })

    renderOrders()
    useAuthStore.getState().applySession({
      token: 'synthetic-access-token-2',
      refreshToken: 'synthetic-refresh-token-2',
      user: {
        id: '15000',
        name: 'Other',
        email: 'other@example.test',
        role: 'customer',
        roles: ['customer'],
        vendors: [],
      },
    })
    await settle()

    first.resolve({
      orders: [order('1941')],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
      lastPage: true,
    })
    await settle()

    expect(screen.getByText('Order #2001')).toBeTruthy()
    expect(screen.queryByText('Order #1941')).toBeNull()
  })

  it('does not fetch history when signed out and keeps Sign in on the page', async () => {
    const list = vi.spyOn(ordersService, 'listMyOrdersPage')
    renderOrders()
    await settle()
    expect(list).not.toHaveBeenCalled()
    expect(screen.getByText('Sign in to see your orders')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0)
  })
})
