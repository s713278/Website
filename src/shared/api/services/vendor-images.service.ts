import { imagesService } from '@mithra/api-client'
import { demoProductImage, setDemoProductImage } from '../fixtures/demo-state'
import { mapVendorImageUrl, type VendorImageKind } from '../mappers/vendor-images'
import { isLiveApi } from '../mode'
import { demoDelay } from './demo-delay'

const IMAGE_TYPES = { logo: 'THUMBNAIL', banner: 'HOMEBANNER' } as const

async function getImage(vendorId: string, kind: VendorImageKind, config: { signal?: AbortSignal } = {}): Promise<string | null> {
  if (!isLiveApi()) return null
  return mapVendorImageUrl(await imagesService.list(vendorId, { image_type: IMAGE_TYPES[kind] }, config))
}

async function uploadImage(
  vendorId: string,
  kind: VendorImageKind,
  file: File,
  config: { signal?: AbortSignal } = {},
): Promise<string> {
  if (!isLiveApi()) throw new Error('Demo images stay in this tab and are not uploaded.')
  const body = new FormData()
  body.append('file', file)
  const url = mapVendorImageUrl(await imagesService.upload(vendorId, body, {
    image_type: IMAGE_TYPES[kind],
  }, config))
  if (!url) throw new Error('The upload did not return an image URL. Please try again.')
  return url
}

/**
 * The vendor's own photo for one product, or `null` when they have not uploaded one.
 *
 * `productId` is the vendor product id. The read never falls back to the platform photo,
 * so `null` means this shop has no photo of its own.
 */
async function getProductImage(
  vendorId: string,
  productId: string,
  config: { signal?: AbortSignal } = {},
): Promise<string | null> {
  if (!isLiveApi()) {
    await demoDelay()
    config.signal?.throwIfAborted()
    return demoProductImage(productId)
  }
  return mapVendorImageUrl(await imagesService.list(vendorId, {
    image_type: 'PRODUCT',
    reference_id: Number(productId),
  }, config))
}

/** Replaces this shop's photo for one product. Each upload returns a new URL. */
async function uploadProductImage(
  vendorId: string,
  productId: string,
  file: File,
  config: { signal?: AbortSignal } = {},
): Promise<string> {
  if (!isLiveApi()) {
    await demoDelay()
    config.signal?.throwIfAborted()
    // Demo photos live only in this tab, like the rest of demo state.
    const previous = demoProductImage(productId)
    if (previous) URL.revokeObjectURL(previous)
    const url = URL.createObjectURL(file)
    setDemoProductImage(productId, url)
    return url
  }
  const body = new FormData()
  body.append('file', file)
  const url = mapVendorImageUrl(await imagesService.upload(vendorId, body, {
    image_type: 'PRODUCT',
    reference_id: Number(productId),
  }, config))
  if (!url) throw new Error('The upload did not return a photo URL. Please try again.')
  return url
}

export const vendorImagesService = { getImage, uploadImage, getProductImage, uploadProductImage }
