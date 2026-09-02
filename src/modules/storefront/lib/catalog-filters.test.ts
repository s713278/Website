import { describe, expect, it } from 'vitest'
import type { Product } from '@/modules/storefront/types'
import { productMatchesSearch } from './catalog-filters'

function product(overrides: Partial<Product> & Pick<Product, 'name'>): Product {
  const { name, ...rest } = overrides
  return {
    id: 'p1',
    name,
    description: '',
    price: 100,
    veg: true,
    ...rest,
  }
}

describe('productMatchesSearch', () => {
  it('does not match description words like "the" for short query "he"', () => {
    const flour = product({
      name: 'Flours',
      description: 'The finest stone-ground flour for daily rotis',
    })
    expect(productMatchesSearch(flour, 'he')).toBe(false)
  })

  it('matches product names that start with the query', () => {
    expect(productMatchesSearch(product({ name: 'Herbs Mix' }), 'he')).toBe(true)
  })

  it('matches substring in name for longer queries', () => {
    expect(productMatchesSearch(product({ name: 'Mango Pickle' }), 'pick')).toBe(true)
  })

  it('matches description words by prefix for longer queries', () => {
    expect(
      productMatchesSearch(
        product({ name: 'Rice', description: 'Healthy everyday staple' }),
        'hea',
      ),
    ).toBe(true)
  })
})
