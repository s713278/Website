import { useCallback, useEffect, useState } from 'react'
import { vendorImagesService } from '@/shared/api'

export type ProductPhoto =
  | { status: 'loading' }
  /** `url` is null when this shop has not uploaded a photo of its own. */
  | { status: 'ready'; url: string | null }
  | { status: 'failed' }
  /** No vendor product id, so there is nothing to read or upload against. */
  | { status: 'unavailable' }

/**
 * This shop's own photo for one product. Rows mount only for the page on screen, so a page
 * reads at most one photo per visible product.
 */
export function useProductPhoto(vendorId: string, productId: string | null) {
  const [photo, setPhoto] = useState<ProductPhoto>({ status: 'loading' })
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    const controller = new AbortController()
    setPhoto({ status: 'loading' })

    vendorImagesService
      .getProductImage(vendorId, productId, { signal: controller.signal })
      .then((url) => {
        if (!cancelled) setPhoto({ status: 'ready', url })
      })
      .catch(() => {
        if (!cancelled) setPhoto({ status: 'failed' })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [vendorId, productId, retryToken])

  const retry = useCallback(() => setRetryToken((token) => token + 1), [])
  const showUploaded = useCallback((url: string) => setPhoto({ status: 'ready', url }), [])

  return { photo: productId ? photo : ({ status: 'unavailable' } as const), retry, showUploaded }
}
