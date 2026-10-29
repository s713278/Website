import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetPaidOrders,
  PAID_ORDERS_STORAGE_KEY,
  readPaidOrders,
  recordPaidOrder,
} from './paid-orders-store'

/**
 * The vendor's ledger. It is the only copy: no backend route stores a payment, so a bug
 * here loses a record nothing else holds. See
 * `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`.
 */

let store: Map<string, string>

function useStorage(overrides: Partial<Storage> = {}) {
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    ...overrides,
  }
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('window', { localStorage })
}

beforeEach(() => {
  store = new Map()
  useStorage()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readPaidOrders', () => {
  it('remembers an order the vendor marked paid', () => {
    recordPaidOrder('262', '1931', true)

    expect([...readPaidOrders('262')]).toEqual(['1931'])
  })

  it('keeps two vendor accounts on one device apart', () => {
    recordPaidOrder('262', '1931', true)
    recordPaidOrder('999', '4040', true)

    expect([...readPaidOrders('262')]).toEqual(['1931'])
    expect([...readPaidOrders('999')]).toEqual(['4040'])
  })

  it('forgets an order the vendor unmarked, and leaves the rest alone', () => {
    recordPaidOrder('262', '1931', true)
    recordPaidOrder('262', '1932', true)

    recordPaidOrder('262', '1931', false)

    expect([...readPaidOrders('262')]).toEqual(['1932'])
  })

  it('records an order once however many times it is marked', () => {
    recordPaidOrder('262', '1931', true)
    recordPaidOrder('262', '1931', true)

    expect([...readPaidOrders('262')]).toEqual(['1931'])
  })

  it.each([
    ['unparseable', 'not json at all'],
    ['a bare array', '[]'],
    ['a value from a future version', '{"version":99,"vendors":{"262":["1931"]}}'],
    ['vendors that is not an object', '{"version":1,"vendors":"1931"}'],
    ['order ids that are not strings', '{"version":1,"vendors":{"262":[1931]}}'],
  ])('degrades to nothing marked paid when the stored value is %s', (_label, raw) => {
    store.set(PAID_ORDERS_STORAGE_KEY, raw)

    expect(() => readPaidOrders('262')).not.toThrow()
    expect([...readPaidOrders('262')]).toEqual([])
  })

  it('starts a fresh record rather than failing on a corrupt one', () => {
    store.set(PAID_ORDERS_STORAGE_KEY, 'not json at all')

    recordPaidOrder('262', '1931', true)

    expect([...readPaidOrders('262')]).toEqual(['1931'])
  })

  it('reads nothing, rather than throwing, in a browser that refuses storage', () => {
    useStorage({
      getItem: () => {
        throw new Error('The operation is insecure.')
      },
    })

    expect([...readPaidOrders('262')]).toEqual([])
  })
})

describe('recordPaidOrder', () => {
  it('fails loudly when the browser refuses to store it', () => {
    // The alternative is a vendor told their record was kept when nothing kept it —
    // the same lie a silently failed write tells, which this console exists to stop.
    useStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(() => recordPaidOrder('262', '1931', true)).toThrow()
  })
})

describe('forgetPaidOrders', () => {
  it('drops only the orders it was given', () => {
    recordPaidOrder('262', '1931', true)
    recordPaidOrder('262', '1932', true)

    forgetPaidOrders('262', ['1931'])

    expect([...readPaidOrders('262')]).toEqual(['1932'])
  })

  it('stays quiet when the browser refuses the write, because a read asked for it', () => {
    // Called while layering a backend PAID over the local note. A failed tidy-up must not
    // turn a successful order read into a failed one.
    recordPaidOrder('262', '1931', true)
    useStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(() => forgetPaidOrders('262', ['1931'])).not.toThrow()
  })
})

describe('writing nothing', () => {
  it('does not rewrite the file to unmark an order that was never marked', () => {
    // Not an optimisation: the write can throw, and it must not throw over a change that
    // was not being made.
    recordPaidOrder('262', '1931', true)
    const written = store.get(PAID_ORDERS_STORAGE_KEY)
    useStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(() => recordPaidOrder('262', '4040', false)).not.toThrow()
    expect(store.get(PAID_ORDERS_STORAGE_KEY)).toBe(written)
  })
})
