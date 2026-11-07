import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'

const NOW = new Date('2026-09-09T12:00:00Z').getTime()
const jwt = (exp: number) => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'test-user', exp })}.synthetic`
}

let api: typeof import('@/shared/api')
let useAuthStore: typeof import('./auth-store')['useAuthStore']
let axios: typeof import('axios')['default']
let originalAdapter: typeof axios.defaults.adapter
let requests: { url: string; authorization: unknown }[]
let refreshedToken: string

beforeEach(async () => {
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubGlobal('window', { localStorage: globalThis.localStorage })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  requests = []
  refreshedToken = jwt(NOW / 1000 + 600)
  axios = (await import('axios')).default
  originalAdapter = axios.defaults.adapter
  // Exercise real refresh, interceptors and storage, with no network connection.
  const adapter: AxiosAdapter = async (config) => {
    const url = config.url ?? ''
    requests.push({ url, authorization: config.headers.get('Authorization') })
    return {
      status: 200, statusText: 'OK', headers: {}, config,
      data: { success: true, data: url.endsWith('/auth/refresh') ? refreshedToken : {} },
    }
  }
  axios.defaults.adapter = adapter
  api = await import('@/shared/api')
  useAuthStore = (await import('./auth-store')).useAuthStore
})

afterEach(() => {
  useAuthStore.getState().clearSession()
  axios.defaults.adapter = originalAdapter
  api.resetHttpClient()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function login(token: string) {
  useAuthStore.getState().applySession({
    token, refreshToken: 'synthetic-refresh',
    user: {
      id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
      role: 'vendor', roles: ['vendor'], vendors: [{ vendorId: 'test-vendor' }],
      vendorId: 'test-vendor',
    },
  })
}

async function reload() {
  useAuthStore.getState().setHydrated(false)
  await useAuthStore.persist.rehydrate()
  await useAuthStore.getState().restoreSession()
}

const refreshRequests = () => requests.filter(({ url }) => url.endsWith('/auth/refresh'))

describe('session restoration', () => {
  it('keeps a refreshed token through repeated reloads without refreshing again', async () => {
    login(jwt(NOW / 1000 - 60))
    await api.apiGet('/v1/vendors/test-vendor/context')
    expect(refreshRequests()).toHaveLength(1)

    for (let count = 0; count < 2; count++) {
      await reload()
      await api.apiGet('/v1/vendors/test-vendor/context')
    }

    expect(refreshRequests()).toHaveLength(1)
    expect(requests.filter(({ url }) => !url.endsWith('/auth/refresh'))).toHaveLength(3)
    expect(requests.at(-1)?.authorization).toBe(`Bearer ${refreshedToken}`)
    expect(api.getRefreshToken()).toBe('synthetic-refresh')
  })

  it('ignores a legacy md-auth token when a newer token is already stored', async () => {
    const oldToken = jwt(NOW / 1000 - 60)
    login(oldToken)
    const user = useAuthStore.getState().user
    api.setTokens(refreshedToken)
    localStorage.setItem('md-auth', JSON.stringify({ state: { user, token: oldToken }, version: 0 }))

    await useAuthStore.persist.rehydrate()
    await useAuthStore.getState().restoreSession()
    await api.apiGet('/v1/vendors/test-vendor/context')

    expect(refreshRequests()).toHaveLength(0)
    expect(api.getAccessToken()).toBe(refreshedToken)
    expect(JSON.parse(localStorage.getItem('md-auth') ?? '{}').state).not.toHaveProperty('token')
  })

  it('does not restore a legacy token after the API credentials have been cleared', async () => {
    login(refreshedToken)
    const user = useAuthStore.getState().user
    api.clearTokens()
    localStorage.setItem('md-auth', JSON.stringify({ state: { user, token: refreshedToken }, version: 0 }))

    await useAuthStore.persist.rehydrate()
    await useAuthStore.getState().restoreSession()

    expect(api.getAccessToken()).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isHydrated).toBe(true)
  })

  it('restores a refresh-only session without losing its refresh credential', async () => {
    login(refreshedToken)
    api.setTokens(null)

    await reload()

    expect(refreshRequests()).toHaveLength(1)
    expect(api.getAccessToken()).toBe(refreshedToken)
    expect(api.getRefreshToken()).toBe('synthetic-refresh')
    expect(useAuthStore.getState().user?.id).toBe('test-user')
  })

  it('does not refresh a login token that is still usable', async () => {
    login(refreshedToken)
    await reload()
    await api.apiGet('/v1/vendors/test-vendor/context')
    expect(refreshRequests()).toHaveLength(0)
  })
})
