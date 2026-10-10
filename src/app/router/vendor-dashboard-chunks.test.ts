import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.doUnmock('@/modules/vendor/components/VendorShell')
  vi.doUnmock('@/modules/vendor/pages/VendorOverviewPage')
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
