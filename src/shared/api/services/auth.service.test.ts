import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `verify-otp` refusals must not leave credentials behind.
 *
 * The package-level `verifyOtp` stores whatever tokens come back before this service
 * gets to judge the response, so every path that refuses to build a session has to undo
 * that. A stored token for a login the app rejected is a live bearer credential on disk
 * with no session to explain it — and, when a vendor was already signed in, it is the
 * *other* number's token sitting under the first vendor's persisted user.
 */

vi.mock('../mode', () => ({ isLiveApi: () => true }))

vi.mock('@mithra/api-client', async () => {
  const actual = await vi.importActual<typeof import('@mithra/api-client')>('@mithra/api-client')
  return {
    ...actual,
    // Mirrors the real package behaviour: tokens are written before the caller can
    // inspect `mobile_verified` or `roles`. See packages/api-client/src/services/auth.ts.
    verifyOtp: vi.fn(async () => {
      actual.setTokens(ACCESS_TOKEN, REFRESH_TOKEN)
      return verifyOtpResponse
    }),
  }
})

const ACCESS_TOKEN = 'aaa.bbb.ccc'
const REFRESH_TOKEN = 'ddd.eee.fff'

let verifyOtpResponse: unknown

function installLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  })
}

function envelope(data: Record<string, unknown>) {
  return { success: true, status: 200, data: { access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, ...data } }
}

describe('verifyOtp credential handling', () => {
  beforeEach(() => {
    installLocalStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the tokens when the session is accepted', async () => {
    const { authService } = await import('./auth.service')
    const { getAccessToken, getRefreshToken } = await import('@mithra/api-client')
    verifyOtpResponse = envelope({ mobile_verified: true, roles: ['VENDOR'], user_id: 7, vendors: [{ vendor_id: 42 }] })

    const session = await authService.verifyOtp({ phone: '9876543210', otp: '1234', role: 'vendor' })

    expect(session.user.vendorId).toBe('42')
    expect(getAccessToken()).toBe(ACCESS_TOKEN)
    expect(getRefreshToken()).toBe(REFRESH_TOKEN)
  })

  it('clears the tokens when the number is not verified', async () => {
    const { authService } = await import('./auth.service')
    const { getAccessToken, getRefreshToken } = await import('@mithra/api-client')
    verifyOtpResponse = envelope({ mobile_verified: false, roles: ['VENDOR'] })

    await expect(
      authService.verifyOtp({ phone: '9876543210', otp: '1234', role: 'vendor' }),
    ).rejects.toThrow(/not verified/i)

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('clears the tokens when the requested role was not granted', async () => {
    const { authService } = await import('./auth.service')
    const { getAccessToken, getRefreshToken } = await import('@mithra/api-client')
    verifyOtpResponse = envelope({ mobile_verified: true, roles: ['USER'] })

    await expect(
      authService.verifyOtp({ phone: '9876543210', otp: '1234', role: 'vendor' }),
    ).rejects.toThrow(/not registered as a vendor/i)

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('does not leave a second number’s tokens behind for the signed-in vendor', async () => {
    const { authService } = await import('./auth.service')
    const { getAccessToken, setTokens } = await import('@mithra/api-client')
    // Vendor A is signed in and is changing their number from inside the wizard.
    setTokens('vendor.a.token', 'vendor.a.refresh')
    verifyOtpResponse = envelope({ mobile_verified: true, roles: ['USER'] })

    await expect(
      authService.verifyOtp({ phone: '9876543211', otp: '1234', role: 'vendor' }),
    ).rejects.toThrow()

    // Vendor A's tokens are gone either way — the package overwrote them. What must not
    // happen is the refused number's token being left in their place.
    expect(getAccessToken()).not.toBe(ACCESS_TOKEN)
    expect(getAccessToken()).toBeNull()
  })
})

describe('credential-refusal cleanup is independent of any UI', () => {
  // The OTP screens return early when their request is stale or the component unmounted,
  // so cleanup cannot live there. It also has to cover post-response failures that are
  // not AuthSessionError — a success envelope with no usable token has written
  // credentials just the same.
  beforeEach(() => {
    installLocalStorage()
  })

  it('fires on a role refusal, with no caller involved', async () => {
    const { authService, onCredentialsRefused } = await import('./auth.service')
    let fired = 0
    const off = onCredentialsRefused(() => { fired += 1 })
    verifyOtpResponse = envelope({ mobile_verified: true, roles: ['USER'] })

    await expect(
      authService.verifyOtp({ phone: '9876543210', otp: '1234', role: 'vendor' }),
    ).rejects.toThrow()

    expect(fired).toBe(1)
    off()
  })

  it('fires when a successful envelope carries no usable token', async () => {
    const { authService, onCredentialsRefused } = await import('./auth.service')
    const { setTokens } = await import('@mithra/api-client')
    let fired = 0
    const off = onCredentialsRefused(() => { fired += 1 })
    // Tokens are written by the package, then the payload turns out to be unusable.
    setTokens(ACCESS_TOKEN, REFRESH_TOKEN)
    verifyOtpResponse = { success: true, status: 200, data: { mobile_verified: true, roles: ['VENDOR'] } }

    await expect(
      authService.verifyOtp({ phone: '9876543210', otp: '1234', role: 'vendor' }),
    ).rejects.toThrow(/access token/i)

    expect(fired).toBe(1)
    off()
  })

  it('does not fire when the session is accepted', async () => {
    const { authService, onCredentialsRefused } = await import('./auth.service')
    let fired = 0
    const off = onCredentialsRefused(() => { fired += 1 })
    verifyOtpResponse = envelope({ mobile_verified: true, roles: ['VENDOR'], user_id: 7, vendors: [{ vendor_id: 42 }] })

    await authService.verifyOtp({ phone: '9876543210', otp: '1234', role: 'vendor' })

    expect(fired).toBe(0)
    off()
  })
})
