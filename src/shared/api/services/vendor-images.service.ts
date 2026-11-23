import { imagesService } from '@mithra/api-client'
import { mapVendorImageUrl, type VendorImageKind } from '../mappers/vendor-images'
import { isLiveApi } from '../mode'

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

export const vendorImagesService = { getImage, uploadImage }
