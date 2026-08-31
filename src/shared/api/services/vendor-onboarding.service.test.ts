import { describe, expect, it } from 'vitest'
import { settleMeasurementDetails } from './vendor-onboarding.service'

describe('measurement detail requests', () => {
  it('keeps fulfilled detail payloads when another detail request fails', async () => {
    const area = { data: { id: 4, type: 'AREA', unit_options: [50, 100] } }
    const volume = { data: { id: 2, type: 'VOLUME', unit_options: [0.5, 1] } }

    await expect(settleMeasurementDetails([
      Promise.resolve(area),
      Promise.reject(new Error('one detail is unavailable')),
      Promise.resolve(volume),
    ])).resolves.toEqual([area, volume])
  })

  it('preserves cancellation rather than treating it as a recoverable row failure', async () => {
    const controller = new AbortController()
    const reason = new Error('catalog request cancelled')
    controller.abort(reason)

    await expect(settleMeasurementDetails(
      [Promise.reject(reason)],
      controller.signal,
    )).rejects.toBe(reason)
  })
})
