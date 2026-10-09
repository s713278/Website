// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StoreSharePanels } from './StoreSharePanels'

afterEach(cleanup)

describe('StoreSharePanels', () => {
  it('opens the storefront in a new tab so the vendor keeps this screen', () => {
    render(
      <MemoryRouter>
        <StoreSharePanels identifier="anithas-pickles" storeName="Anitha's Pickles" />
      </MemoryRouter>,
    )

    const link = screen.getByRole('button', { name: 'Open storefront' }).closest('a')
    expect(link?.getAttribute('href')).toBe('/stores/anithas-pickles')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noreferrer')
  })
})
