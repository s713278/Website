// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogService } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import { getCachedStore, peekLastCachedStoreId, useStorePage, type StorePageNetwork } from './useStorePage'

const store = (id: string) => ({ id, name: `Shop ${id}`, products: [] }) as unknown as Store

function Probe({ storeId, network }: { storeId: string; network?: StorePageNetwork }) {
  const { store: shown, loading, error } = useStorePage(storeId, network ? { network } : undefined)
  return <p>{loading ? 'loading' : error || shown?.name || 'no store'}</p>
}

async function renderProbe(storeId: string, network?: StorePageNetwork) {
  await act(async () => {
    render(<Probe storeId={storeId} network={network} />)
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useStorePage', () => {
  it('always reads the storefront by default, and caches it for the other pages', async () => {
    const getStore = vi.spyOn(catalogService, 'getStore').mockResolvedValue(store('s1'))
    await renderProbe('s1')
    cleanup()
    await renderProbe('s1')
    expect(getStore).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Shop s1')).toBeTruthy()
    expect(getCachedStore('s1')?.name).toBe('Shop s1')
    expect(peekLastCachedStoreId()).toBe('s1')
  })

  it('cache-first reads the storefront only on a cache miss', async () => {
    const getStore = vi.spyOn(catalogService, 'getStore').mockResolvedValue(store('s2'))
    await renderProbe('s2', 'cache-first')
    cleanup()
    await renderProbe('s2', 'cache-first')
    expect(getStore).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Shop s2')).toBeTruthy()
  })

  it('cache-only never reads the storefront, and shows none on a miss', async () => {
    const getStore = vi.spyOn(catalogService, 'getStore').mockResolvedValue(store('s3'))
    await renderProbe('s3', 'cache-only')
    expect(getStore).not.toHaveBeenCalled()
    expect(screen.getByText('no store')).toBeTruthy()
    expect(getCachedStore('s3')).toBeNull()
  })

  it('cache-only shows a cached store', async () => {
    vi.spyOn(catalogService, 'getStore').mockResolvedValue(store('s4'))
    await renderProbe('s4')
    cleanup()
    const getStore = vi.spyOn(catalogService, 'getStore')
    getStore.mockClear()
    await renderProbe('s4', 'cache-only')
    expect(getStore).not.toHaveBeenCalled()
    expect(screen.getByText('Shop s4')).toBeTruthy()
  })
})
