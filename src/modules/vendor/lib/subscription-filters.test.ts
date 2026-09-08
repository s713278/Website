import { describe, expect, it } from 'vitest'
import {
  SUBSCRIPTION_STATUS_FILTERS,
  readSubscriptionsQuery,
  writeSubscriptionsQuery,
} from './subscription-filters'

describe('subscription filter URL state', () => {
  it('defaults to every subscription on the first page', () => {
    expect(readSubscriptionsQuery(new URLSearchParams())).toEqual({ status: null, page: 0 })
  })

  it('round-trips every status the screen offers', () => {
    for (const status of SUBSCRIPTION_STATUS_FILTERS) {
      const params = writeSubscriptionsQuery({ status, page: 3 })

      expect(readSubscriptionsQuery(params)).toEqual({ status, page: 3 })
    }
  })

  it('clears the status without leaving an empty query value behind', () => {
    const params = writeSubscriptionsQuery({ status: null, page: 0 })

    expect(params.toString()).toBe('')
  })

  it('ignores statuses the filter does not offer and invalid page numbers', () => {
    expect(readSubscriptionsQuery(new URLSearchParams('status=UNKNOWN&page=-2'))).toEqual({
      status: null,
      page: 0,
    })
  })
})
