import { describe, expect, it } from 'vitest'
import type { User } from '@/shared/types'
import { accountLabel } from './account-label'

function user(overrides: Partial<User>): User {
  return {
    id: 'test-user', name: 'User', email: 'user@example.test',
    role: 'customer', roles: ['customer'], vendors: [],
    ...overrides,
  }
}

describe('accountLabel', () => {
  it('names a vendor session after the selected store', () => {
    expect(accountLabel(user({
      name: 'Vendor', role: 'vendor', roles: ['vendor'],
      vendors: [{ vendorId: 'v-1', name: 'Other Store' }, { vendorId: 'v-2', name: ' Green Bowl Grocers ' }],
      vendorId: 'v-2',
    }))).toBe('Green Bowl Grocers')
  })

  it('leaves a vendor unlabelled without a selected, named store', () => {
    const vendors = [{ vendorId: 'v-1', name: 'Green Bowl Grocers' }]
    expect(accountLabel(user({ name: 'Asha', role: 'vendor', roles: ['vendor'], vendors }))).toBe('')
    expect(accountLabel(user({ name: 'Asha', role: 'vendor', roles: ['vendor'], vendors: [{ vendorId: 'v-1' }], vendorId: 'v-1' }))).toBe('')
  })

  it('names a customer by their real name', () => {
    expect(accountLabel(user({ name: ' Asha Rao ', phone: '9876543210' }))).toBe('Asha Rao')
  })

  // `sessionDisplayName` stands these in for a missing or phone-like API name.
  it.each(['User', 'Vendor', '', '  '])('leaves a customer named %j unlabelled, with no phone fallback', (name) => {
    expect(accountLabel(user({ name, phone: '9876543210' }))).toBe('')
  })
})
