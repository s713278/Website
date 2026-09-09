import { vendorsService as apiVendorsService } from '@mithra/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settleMeasurementDetails, vendorOnboardingService } from './vendor-onboarding.service'

let live = true

vi.mock('../mode', () => ({ isLiveApi: () => live }))

beforeEach(() => {
  live = true
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getVendorContext', () => {
  it('returns the mapped demo context without issuing a request', async () => {
    live = false
    const request = vi.spyOn(apiVendorsService, 'getContext').mockRejectedValue(
      new Error('Demo mode must not reach the backend.'),
    )

    await expect(vendorOnboardingService.getVendorContext('r1')).resolves.toMatchObject({
      vendorId: 'r1',
      vendorStatus: 'ACTIVE',
      approvalStatus: 'APPROVED',
      onboarding: { status: 'COMPLETED', nextStep: 11 },
      subscription: {
        tier: 'FREE',
        trialEndsAt: null,
      },
    })
    expect(request).not.toHaveBeenCalled()
  })
})

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
