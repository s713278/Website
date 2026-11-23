import { getErrorMessage, vendorImagesService, type VendorImageKind, type VendorImages } from '@/shared/api'
import type { OnboardingRuntimeState, ValidationIssue } from '../types/onboarding'

export const MAX_VENDOR_IMAGE_BYTES = 5 * 1024 * 1024
export const VENDOR_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif'

export function imageSelectionError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!VENDOR_IMAGE_ACCEPT.split(',').includes(file.type)) return 'Choose a PNG, JPEG, or GIF image. Your previous image is unchanged.'
  if (file.size > MAX_VENDOR_IMAGE_BYTES) return 'Choose an image of 5 MB or smaller. Your previous image is unchanged.'
  return null
}

export class ImageSaveError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '))
    this.name = 'ImageSaveError'
    this.issues = issues
  }
}

export type ImageSaveOptions = {
  signal?: AbortSignal
  isCurrent?: () => boolean
  onUploaded?: (kind: VendorImageKind, file: File, url: string) => void
}

/** Report each success immediately: a failed sibling must never cause it to be uploaded again. */
export async function savePendingImages(
  vendorId: string,
  runtime: OnboardingRuntimeState,
  options: ImageSaveOptions,
): Promise<VendorImages> {
  const images: VendorImages = { logo: runtime.savedLogoUrl, banner: runtime.savedBannerUrl }
  const issues: ValidationIssue[] = []
  for (const kind of ['logo', 'banner'] as const) {
    assertImageSaveCurrent(options)
    const file = kind === 'logo' ? runtime.logoFile : runtime.bannerFile
    if (!file) continue
    try {
      const invalid = imageSelectionError(file)
      if (invalid) throw new Error(invalid)
      const url = await vendorImagesService.uploadImage(vendorId, kind, file, { signal: options.signal })
      assertImageSaveCurrent(options)
      images[kind] = url
      options.onUploaded?.(kind, file, url)
    } catch (error) {
      assertImageSaveCurrent(options)
      issues.push({
        step: 9,
        field: `store-${kind}-file`,
        message: `${kind === 'logo' ? 'Logo' : 'Banner'}: ${getErrorMessage(error, 'Could not upload this image. Please try again.')}`,
      })
    }
  }
  if (issues.length) throw new ImageSaveError(issues)
  return images
}

export function assertImageSaveCurrent(options: ImageSaveOptions): void {
  options.signal?.throwIfAborted()
  if (options.isCurrent && !options.isCurrent()) throw new Error('The image save session has ended.')
}
