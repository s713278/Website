import { describe, expect, it } from 'vitest'
import { MAX_PRODUCT_PHOTO_BYTES, productPhotoSelectionError } from './product-photo'

describe('productPhotoSelectionError', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])('accepts %s', (type) => {
    expect(productPhotoSelectionError({ type, size: 1024 })).toBeNull()
  })

  it.each(['image/svg+xml', 'image/heic', 'application/pdf', ''])('refuses %j', (type) => {
    expect(productPhotoSelectionError({ type, size: 1024 })).toMatch('JPEG, PNG, WebP or GIF')
  })

  it('accepts exactly 3 MB and refuses one byte more', () => {
    expect(productPhotoSelectionError({ type: 'image/png', size: MAX_PRODUCT_PHOTO_BYTES })).toBeNull()
    expect(productPhotoSelectionError({ type: 'image/png', size: MAX_PRODUCT_PHOTO_BYTES + 1 })).toMatch('3 MB or smaller')
  })
})
