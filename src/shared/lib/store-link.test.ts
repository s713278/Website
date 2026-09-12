import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicSiteOrigin, readableUrl, storefrontUrl } from './store-link'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('storefrontUrl', () => {
  it('builds the link from the configured public site, not from the current host', () => {
    // The whole point of the variable: the vendor console runs on localhost, on a Vercel
    // preview and on the real site, and the link it hands a customer is the same one.
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://mithradirect.com')

    expect(storefrontUrl('green-bowl-grocers')).toBe(
      'https://mithradirect.com/stores/green-bowl-grocers',
    )
  })

  it('drops a trailing slash on the configured origin', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://mithradirect.com/')

    expect(storefrontUrl('anitha-pickles')).toBe('https://mithradirect.com/stores/anitha-pickles')
  })

  it('falls back to the current origin when nothing is configured', () => {
    // A clone with no `.env` should still produce a link that opens, rather than one
    // beginning `/stores/…` with no host at all.
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '')

    expect(publicSiteOrigin()).toBe('')
    expect(storefrontUrl('anitha-pickles')).toBe('/stores/anitha-pickles')
  })

  it('treats a blank variable as unset', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '   ')

    expect(publicSiteOrigin()).toBe('')
  })
})

describe('readableUrl', () => {
  it('strips the protocol a vendor would not read out loud', () => {
    expect(readableUrl('https://mithradirect.com/stores/green-bowl-grocers')).toBe(
      'mithradirect.com/stores/green-bowl-grocers',
    )
  })
})
