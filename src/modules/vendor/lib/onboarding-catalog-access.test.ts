import { describe, expect, it } from 'vitest'
import { isAdditiveCatalogStep } from '../types/onboarding'

describe('catalog additions after submission', () => {
  it('allows an approved vendor to save more sizes on Step 6', () => {
    expect(isAdditiveCatalogStep(6, true)).toBe(true)
  })

  it('keeps sizes locked while approval is pending', () => {
    expect(isAdditiveCatalogStep(6, false)).toBe(false)
  })

  it.each([4, 5] as const)('still allows categories and products on Step %i while pending', (step) => {
    expect(isAdditiveCatalogStep(step, false)).toBe(true)
  })
})
