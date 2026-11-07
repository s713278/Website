// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CartButton } from './CartButton'

afterEach(cleanup)

describe('CartButton', () => {
  it.each([
    [0, 'Cart'],
    [1, 'Cart, 1 item'],
    [3, 'Cart, 3 items'],
  ])('names a cart of %i for a screen reader as “%s”', (count, name) => {
    render(
      <MemoryRouter>
        <CartButton to="/cart" count={count} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name }).getAttribute('href')).toBe('/cart')
  })
})
