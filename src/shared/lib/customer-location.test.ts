import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestBrowserCoords } from './customer-location'

type GeoSuccess = (pos: { coords: { latitude: number; longitude: number } }) => void
type GeoFailure = (error: { code: number }) => void

function stubGps(outcome: { latitude: number; longitude: number } | { code: number } | 'missing') {
  if (outcome === 'missing') {
    vi.stubGlobal('navigator', {})
    return
  }
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: GeoSuccess, failure: GeoFailure) => {
        if ('code' in outcome) failure(outcome)
        else success({ coords: outcome })
      },
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('requestBrowserCoords', () => {
  it('uses the GPS fix when the browser can provide one', async () => {
    stubGps({ latitude: 17.38, longitude: 78.48 })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestBrowserCoords()).resolves.toEqual({ latitude: 17.38, longitude: 78.48 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the network location when the device has no GPS position', async () => {
    stubGps({ code: 2 })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ latitude: 22.25, longitude: 70.79 }),
      }),
    )

    await expect(requestBrowserCoords()).resolves.toEqual({ latitude: 22.25, longitude: 70.79 })
  })

  it('does not guess from the network when location permission is blocked', async () => {
    stubGps({ code: 1 })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestBrowserCoords()).rejects.toThrow('Location is blocked for this site')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks for a PIN or city when GPS and the network location both fail', async () => {
    stubGps('missing')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(requestBrowserCoords()).rejects.toThrow(
      'Could not access location. Allow location or enter a PIN / city.',
    )
  })
})
