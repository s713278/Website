import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicSiteOrigin, readableUrl, storefrontUrl } from './store-link'

afterEach(() => {
  vi.unstubAllGlobals()
})

function onSite(origin: string) {
  vi.stubGlobal('window', { location: { origin } })
}

describe('storefrontUrl', () => {
  it('builds the link from the open page and this shop', () => {
    onSite('https://mithradirect.com')

    expect(publicSiteOrigin()).toBe('https://mithradirect.com')
    expect(storefrontUrl('green-bowl-grocers')).toBe(
      'https://mithradirect.com/stores/green-bowl-grocers',
    )
  })

  it('drops a trailing slash on the open page', () => {
    onSite('https://mithradirect.com/')

    expect(storefrontUrl('anitha-pickles')).toBe('https://mithradirect.com/stores/anitha-pickles')
  })

  it('follows the host the page is open on', () => {
    onSite('https://preview.example.test')

    expect(storefrontUrl('anitha-pickles')).toBe('https://preview.example.test/stores/anitha-pickles')
  })

  it('keeps the shop path when no page host is available', () => {
    expect(publicSiteOrigin()).toBe('')
    expect(storefrontUrl('anitha-pickles')).toBe('/stores/anitha-pickles')
  })
})

describe('readableUrl', () => {
  it('strips the protocol a vendor would not read out loud', () => {
    expect(readableUrl('https://mithradirect.com/stores/green-bowl-grocers')).toBe(
      'mithradirect.com/stores/green-bowl-grocers',
    )
  })
})
