import { describe, expect, it } from 'vitest'
import {
  checkoutAddressError,
  checkoutAddressFormFromPin,
  customerNameFromProfile,
  formatCheckoutAddress,
} from './checkout-address-form'

describe('checkoutAddressFormFromPin', () => {
  it('pre-fills name and contact, and splits a map pin into street, city, state, and ZIP', () => {
    expect(
      checkoutAddressFormFromPin({
        userName: 'Aneri',
        userPhone: '919876543210',
        location: 'Road No 27F, Miyapur, Hyderabad, Telangana 500049, India',
        city: 'Hyderabad',
        zipCode: '500049',
      }),
    ).toMatchObject({
      name: 'Aneri',
      contactNumber: '9876543210',
      address1: 'Road No 27F',
      address2: 'Miyapur',
      city: 'Hyderabad',
      state: 'Telangana',
      zipCode: '500049',
    })
  })

  it('keeps a saved street instead of copying the whole pin into address 1', () => {
    expect(
      checkoutAddressFormFromPin({
        userName: 'User',
        recipientName: 'Aneri Shah',
        contactNumber: '9876543210',
        location: 'saved line',
        address1: 'Road No 27F',
        address2: 'Miyapur',
        city: 'Hyderabad',
        district: 'Ranga Reddy',
        state: 'Telangana',
        zipCode: '500049',
      }).address1,
    ).toBe('Road No 27F')
  })
})

describe('customerNameFromProfile', () => {
  it('reads the profile name and ignores the placeholder', () => {
    expect(customerNameFromProfile({ data: { name: 'Riddhi' } })).toBe('Riddhi')
    expect(customerNameFromProfile({ data: { name: 'User' } })).toBe('')
  })
})

describe('checkoutAddressError', () => {
  const complete = {
    name: 'Aneri',
    contactNumber: '9876543210',
    address1: 'Road No 27F',
    address2: '',
    city: 'Hyderabad',
    district: '',
    state: 'Telangana',
    zipCode: '500049',
  }

  it('accepts a complete address with optional locality and district', () => {
    expect(checkoutAddressError(complete)).toBe('')
  })

  it('asks for a 10-digit contact number', () => {
    expect(checkoutAddressError({ ...complete, contactNumber: '98765' })).toMatch(/10-digit/)
  })
})

describe('formatCheckoutAddress', () => {
  it('joins street, locality, city, district, state, and ZIP', () => {
    expect(
      formatCheckoutAddress({
        name: 'Aneri',
        contactNumber: '9876543210',
        address1: 'Road No 27F',
        address2: 'Miyapur',
        city: 'Hyderabad',
        district: 'Ranga Reddy',
        state: 'Telangana',
        zipCode: '500049',
      }),
    ).toBe('Road No 27F, Miyapur, Hyderabad, Ranga Reddy, Telangana 500049')
  })
})
