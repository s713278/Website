/** The backend's limits for a vendor product photo (`image_type=PRODUCT`). */
export const MAX_PRODUCT_PHOTO_BYTES = 3 * 1024 * 1024
export const PRODUCT_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/**
 * Checked before upload so a vendor hears about a wrong file at once. The server checks
 * the file's content again, so a renamed file is still refused there.
 */
export function productPhotoSelectionError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!PRODUCT_PHOTO_ACCEPT.split(',').includes(file.type)) {
    return 'Choose a JPEG, PNG, WebP or GIF photo.'
  }
  if (file.size > MAX_PRODUCT_PHOTO_BYTES) {
    return 'Choose a photo of 3 MB or smaller.'
  }
  return null
}
