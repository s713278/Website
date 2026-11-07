// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaglineExamplesDialog } from './TaglineExamplesDialog'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function openDialog(businessTypeName: string | null, currentTagline = '') {
  const onUse = vi.fn()
  render(<TaglineExamplesDialog businessTypeName={businessTypeName} currentTagline={currentTagline} onUse={onUse} />)
  fireEvent.click(screen.getByRole('button', { name: 'Examples' }))
  return onUse
}

describe('TaglineExamplesDialog', () => {
  it("opens on the vendor's business type and lets them switch to any other", () => {
    openDialog('Bakery')
    expect(screen.getByRole('button', { name: /Bakery/, pressed: true })).toBeTruthy()
    expect(screen.getByText('Freshly baked every morning')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Pet Supplies/ }))
    expect(screen.getByText('Happy pets, happy homes')).toBeTruthy()
    expect(screen.queryByText('Freshly baked every morning')).toBeNull()
  })

  it('fills the tagline and closes on Use', () => {
    const onUse = openDialog(null)
    fireEvent.click(screen.getByRole('button', { name: 'Use “Shop local, shop with trust”' }))
    expect(onUse).toHaveBeenCalledWith('Shop local, shop with trust')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('marks the sample already in use', () => {
    openDialog('Home Kitchen', 'Homely Food, Pure Taste')
    const inUse = screen.getByRole('button', { name: '“Homely Food, Pure Taste” is your tagline' })
    expect(inUse.hasAttribute('disabled')).toBe(true)
  })

  it('copies without filling the field', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onUse = openDialog('Home Kitchen')

    fireEvent.click(screen.getByRole('button', { name: 'Copy “Fresh home-cooked meals daily”' }))
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy())
    expect(writeText).toHaveBeenCalledWith('Fresh home-cooked meals daily')
    expect(onUse).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
