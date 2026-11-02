// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogService, configureApiClient, type LandingStore } from '@/shared/api'
import { ExploreStoresSection } from './MarketingLandingSections'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const store = { id: 'test-store', name: 'Test Corner Store', artworkCandidates: [] } satisfies LandingStore

function renderSection() {
  return render(
    <MemoryRouter>
      <ExploreStoresSection />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_API', 'false')
  configureApiClient({ useApi: false })
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('ExploreStoresSection store list', () => {
  it('shows three card skeletons while the stores load', () => {
    vi.spyOn(catalogService, 'listLandingStores').mockReturnValue(new Promise<never>(() => {}))
    renderSection()

    const status = screen.getByText('Loading stores')
    expect(status.getAttribute('role')).toBe('status')
    const list = status.parentElement!
    expect(list.getAttribute('aria-busy')).toBe('true')
    expect(list.querySelectorAll(':scope > div')).toHaveLength(3)
    expect(screen.queryByText(/Loading stores for this delivery location/)).toBeNull()
  })

  it('shows a load error, not an empty area, and retries the read', async () => {
    const first = deferred<LandingStore[]>()
    const second = deferred<LandingStore[]>()
    const read = vi.spyOn(catalogService, 'listLandingStores')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    renderSection()

    await act(async () => first.reject(new Error('offline')))
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    expect(screen.queryByText('No stores serve this area yet')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(read).toHaveBeenCalledTimes(2)
    await act(async () => second.resolve([store]))
    expect(screen.getByRole('heading', { name: 'Test Corner Store' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
