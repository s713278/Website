import { describe, expect, it } from 'vitest'
import { TAGLINE_EXAMPLE_GROUPS, taglineGroupIdForBusinessType } from './tagline-examples'

describe('taglineGroupIdForBusinessType', () => {
  it.each([
    ['Home Kitchen', 'home-kitchen'],
    ['Pickles', 'pickles'],
    ['Bakery & Snacks', 'bakery'],
    ['Breakfast & Tiffin Center', 'home-kitchen'],
    ['crafts', 'crafts'],
    ['jewellery', 'jewellery'],
    ['Pet Supplies', 'pets'],
    ['Grocery & essentials', 'grocery'],
    ['Home-made products', 'pickles'],
    ['Flowers & gifts', 'florist'],
  ])('opens %s on the %s samples', (name, groupId) => {
    expect(taglineGroupIdForBusinessType(name)).toBe(groupId)
  })

  it.each([null, undefined, '', 'Others', 'Cleaning Supplies'])('falls back to Others for %s', (name) => {
    expect(taglineGroupIdForBusinessType(name)).toBe('others')
  })

  it('gives every group a unique id and three distinct taglines', () => {
    expect(new Set(TAGLINE_EXAMPLE_GROUPS.map((group) => group.id)).size).toBe(TAGLINE_EXAMPLE_GROUPS.length)
    for (const group of TAGLINE_EXAMPLE_GROUPS) {
      expect(new Set(group.taglines).size).toBe(3)
      for (const tagline of group.taglines) expect(tagline.length).toBeLessThanOrEqual(120)
    }
  })
})
