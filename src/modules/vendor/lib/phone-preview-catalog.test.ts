import { describe, expect, it } from 'vitest'
import { phonePreviewAccountParts } from './phone-preview-catalog'

const summary = {
  categories: [{ id: 10, name: 'Juices' }],
  products: [
    { id: 31, name: 'Mango Juice', categoryId: 10, imageUrl: null, price: 60 },
    { id: 32, name: 'Lime Soda', categoryId: 10, imageUrl: 'https://cdn.test/lime.jpg', price: null },
  ],
  activeSkuCount: 4,
}

describe('phonePreviewAccountParts', () => {
  it('shows every catalog part from the summary while no catalog step is read or edited', () => {
    expect(phonePreviewAccountParts({ catalogSource: 'account', catalogPreview: summary, loadedSteps: [3, 7], editedSteps: [] })).toEqual({
      categories: [{ id: 10, name: 'Juices' }],
      products: [
        { id: 31, name: 'Mango Juice', imageUrl: null, price: 60 },
        { id: 32, name: 'Lime Soda', imageUrl: 'https://cdn.test/lime.jpg', price: undefined },
      ],
      sizes: 4,
    })
  })

  it('leaves a part to the draft once its step is read or edited', () => {
    expect(phonePreviewAccountParts({ catalogSource: 'account', catalogPreview: summary, loadedSteps: [4], editedSteps: [5] }))
      .toEqual({ sizes: 4 })
  })

  it('uses the draft throughout without a summary or on the sample catalog', () => {
    expect(phonePreviewAccountParts({ catalogSource: 'account', catalogPreview: null, loadedSteps: [], editedSteps: [] })).toEqual({})
    expect(phonePreviewAccountParts({ catalogSource: 'sample', catalogPreview: summary, loadedSteps: [], editedSteps: [] })).toEqual({})
  })
})
