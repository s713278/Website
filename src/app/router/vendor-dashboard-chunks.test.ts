import { afterEach, describe, expect, it, vi } from 'vitest'

const PAGES = [
  'VendorOverviewPage', 'VendorOrdersPage', 'VendorOrderDetailPage', 'VendorSubscriptionsPage',
  'VendorProductsPage', 'VendorPlanPage', 'VendorStorefrontPage', 'VendorSettingsPage',
] as const

afterEach(() => {
  vi.doUnmock('@/modules/vendor/components/VendorShell')
  for (const page of PAGES) vi.doUnmock(`@/modules/vendor/pages/${page}`)
  vi.resetModules()
})

describe('preloadVendorDashboard', () => {
  it('swallows failed chunk loads, leaving no unhandled rejection', async () => {
    // A rejected dynamic import is what a dropped connection or a stale deployment looks like.
    vi.doMock('@/modules/vendor/components/VendorShell', () => {
      throw new Error('chunk failed: shell')
    })
    vi.doMock('@/modules/vendor/pages/VendorOverviewPage', () => {
      throw new Error('chunk failed: overview')
    })
    const unhandled: unknown[] = []
    const record = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', record)
    try {
      const { loadVendorShell, loadVendorOverviewPage, preloadVendorDashboard } = await import(
        './vendor-dashboard-chunks'
      )
      // Guard the premise: both loaders really do reject here.
      await expect(loadVendorShell()).rejects.toThrow()
      await expect(loadVendorOverviewPage()).rejects.toThrow()

      expect(() => preloadVendorDashboard()).not.toThrow()
      // Let any stray rejection reach the process-level event.
      await new Promise((resolve) => setTimeout(resolve, 20))
    } finally {
      process.off('unhandledRejection', record)
    }

    expect(unhandled).toEqual([])
  })

  it('requests both route chunks', async () => {
    const shell = vi.fn(() => ({ VendorShell: () => null }))
    const overview = vi.fn(() => ({ VendorOverviewPage: () => null }))
    vi.doMock('@/modules/vendor/components/VendorShell', shell)
    vi.doMock('@/modules/vendor/pages/VendorOverviewPage', overview)
    const { preloadVendorDashboard } = await import('./vendor-dashboard-chunks')

    preloadVendorDashboard()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(shell).toHaveBeenCalledTimes(1)
    expect(overview).toHaveBeenCalledTimes(1)
  })
})

describe('preloadVendorPage', () => {
  it.each([
    ['/vendor', ['VendorOverviewPage']],
    ['/vendor/', ['VendorOverviewPage']],
    ['/vendor/orders', ['VendorOrdersPage']],
    ['/vendor/orders/subscriptions', ['VendorSubscriptionsPage']],
    ['/vendor/orders/ord-42', ['VendorOrderDetailPage']],
    ['/vendor/products', ['VendorProductsPage']],
    ['/vendor/plan', ['VendorPlanPage']],
    ['/vendor/storefront', ['VendorStorefrontPage']],
    ['/vendor/settings', ['VendorSettingsPage']],
    ['/vendor/unknown', []],
    ['/vendor/products/extra', []],
    ['/vendor/orders/ord-42/extra', []],
    ['/orders', []],
  ])('requests only the chunk %s renders', async (pathname, expected) => {
    const requested: string[] = []
    const shell = vi.fn(() => ({ VendorShell: () => null }))
    vi.doMock('@/modules/vendor/components/VendorShell', shell)
    for (const page of PAGES) {
      vi.doMock(`@/modules/vendor/pages/${page}`, () => {
        requested.push(page)
        return { [page]: () => null }
      })
    }
    const { preloadVendorPage } = await import('./vendor-dashboard-chunks')

    preloadVendorPage(pathname)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(requested).toEqual(expected)
    expect(shell).not.toHaveBeenCalled()
  })
})

describe('page chunk loaders', () => {
  it('remember the module once it has arrived', async () => {
    vi.doMock('@/modules/vendor/pages/VendorProductsPage', () => ({ VendorProductsPage: () => null }))
    const { loadVendorProductsPage } = await import('./vendor-dashboard-chunks')

    expect(loadVendorProductsPage.loaded()).toBeUndefined()
    const module = await loadVendorProductsPage()
    expect(loadVendorProductsPage.loaded()).toBe(module)
  })
})
