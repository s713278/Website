import { describe, expect, it } from 'vitest'
import { isAccessTokenExpired } from '@/shared/api'

/**
 * The backend issues access tokens with a 600-second TTL, so a vendor who reloads
 * /vendor after ten minutes idle holds an expired-but-present token. Before this check
 * existed the only expiry detector was the 401 interceptor, which cost a doomed request
 * on every such load — three serial round trips to first paint instead of two.
 *
 * Verified against the deployed dev API on 2026-09-04: `exp - iat === 600`.
 */

/** Builds a JWT-shaped token with the given `exp`. Signature is never verified client-side. */
function tokenExpiringAt(expSeconds: number): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '1', exp: expSeconds })}.sig`
}

const NOW = 1_788_512_491_000 // ms

describe('isAccessTokenExpired', () => {
  it('reports an already-expired token as expired', () => {
    expect(isAccessTokenExpired(tokenExpiringAt(NOW / 1000 - 1), NOW)).toBe(true)
  })

  it('reports a token with plenty of life left as usable', () => {
    expect(isAccessTokenExpired(tokenExpiringAt(NOW / 1000 + 600), NOW)).toBe(false)
  })

  it('treats a token inside the skew window as expired, so it is not spent mid-flight', () => {
    // 10s of remaining life is not enough to survive a ~0.5s round trip plus clock drift.
    expect(isAccessTokenExpired(tokenExpiringAt(NOW / 1000 + 10), NOW)).toBe(true)
  })

  it('leaves a non-JWT token to the 401 path rather than forcing a refresh', () => {
    // The refresh token is an opaque UUID; nothing guarantees the access token is a JWT.
    expect(isAccessTokenExpired('75042188-bdbe-4c85-bbc8-50598c7c64fc', NOW)).toBe(false)
  })

  it('treats a malformed payload as usable rather than refreshing on every request', () => {
    expect(isAccessTokenExpired('not.valid-base64!!.sig', NOW)).toBe(false)
  })

  it('treats a JWT with no exp claim as usable', () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    expect(isAccessTokenExpired(`${b64({})}.${b64({ sub: '1' })}.sig`, NOW)).toBe(false)
  })

  it('reports an absent token as not-expired, since there is nothing to refresh against', () => {
    expect(isAccessTokenExpired(null, NOW)).toBe(false)
  })
})
