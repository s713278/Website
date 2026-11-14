import { imagesService, isApiError } from '@mithra/api-client'
import { mapVendorImageUrl, type VendorImageKind } from '../mappers/vendor-images'
import { isLiveApi } from '../mode'

const IMAGE_TYPES = { logo: 'THUMBNAIL', banner: 'HOMEBANNER' } as const

async function getImage(vendorId: string, kind: VendorImageKind, config: { signal?: AbortSignal } = {}): Promise<string | null> {
  if (!isLiveApi()) return null
  try {
    return mapVendorImageUrl(await imagesService.list(vendorId, { image_type: IMAGE_TYPES[kind] }, config))
  } catch (error) {
    // TEMP(vendor-image-404): QA answers 404 "No data found!!" for a logo or banner that was
    // never uploaded, instead of the contract's 200 with a null `image_url`. Treat it as no image
    // until the backend fix; removal steps in docs/API_GAPS.md#temporary-image-404-as-no-image.
    if (isApiError(error) && error.status === 404) return null
    throw error
  }
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

export const vendorImagesService = { getImage, uploadImage }
