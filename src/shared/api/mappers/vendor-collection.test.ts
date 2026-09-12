import { describe, expect, it } from 'vitest'
import { vendorCollectionRows } from './vendor'

/**
 * Vendor collection endpoints answer in two different shapes, and the dashboard read the
 * wrong one. `GET /v1/vendors/{id}/products` returns `data: []`, but
 * `GET /v1/vendors/{id}/orders/` returns a paginated container —
 * `data: { result: [], page_number, page_size, total_elements, total_pages, last_page }`.
 *
 * Testing `Array.isArray` on the container is always false, so every order silently
 * vanished and the dashboard reported zero open orders and zero revenue however many
 * orders existed. Both shapes verified live on 2026-09-04.
 *
 * `mappers/vendor-dashboard.ts` calls this same function, so these cases guard the live
 * dashboard read rather than an unused sibling.
 */
describe('vendorCollectionRows', () => {
  it('reads a bare array, the shape /products returns', () => {
    expect(vendorCollectionRows([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('reads the paginated container, the shape /orders/ returns', () => {
    const page = {
      result: [{ id: 1, status: 'PENDING' }],
      page_number: 0,
      page_size: 20,
      total_elements: 1,
      total_pages: 1,
      last_page: true,
    }
    expect(vendorCollectionRows(page)).toEqual([{ id: 1, status: 'PENDING' }])
  })

  it("reads Spring's `content` container", () => {
    expect(vendorCollectionRows({ content: [{ id: 3 }], totalPages: 1 })).toEqual([{ id: 3 }])
  })

  it('returns nothing for an empty page rather than the container itself', () => {
    expect(vendorCollectionRows({ result: [], page_number: 0, last_page: true })).toEqual([])
  })

  it('drops non-object rows instead of passing them to a field read', () => {
    expect(vendorCollectionRows([{ id: 1 }, null, 'nope', 7])).toEqual([{ id: 1 }])
  })

  it('degrades to empty on an unrecognized shape rather than throwing', () => {
    // The dashboard must still render if orders come back oddly; it is one tile, not the page.
    expect(vendorCollectionRows({ unexpected: true })).toEqual([])
    expect(vendorCollectionRows(null)).toEqual([])
    expect(vendorCollectionRows('nope')).toEqual([])
    expect(vendorCollectionRows(undefined)).toEqual([])
  })
})
