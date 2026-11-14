import { useEffect, useState } from 'react'
import type { Product } from '@/modules/storefront/types'
import type { ShareTarget } from '@/modules/storefront/lib/product-share'
import { getErrorMessage, getStorefrontProduct } from '@/shared/api'
import { ProductGrid } from './ProductGrid'
import { ProductGridSkeleton } from './ProductGridSkeleton'

type SharedProductListProps = {
  storeId: string
  storeName: string
  targets: ShareTarget[]
}

type SharedRow = {
  product: Product
  skuId?: string
}

export function SharedProductList({
  storeId,
  storeName,
  targets,
}: SharedProductListProps) {
  const [rows, setRows] = useState<SharedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    void Promise.all(
      targets.map(async (target) => {
        try {
          const product = await getStorefrontProduct(storeId, target.productId)
          return product ? { product, skuId: target.skuId } : null
        } catch (err) {
          return { failed: getErrorMessage(err, 'Could not load the shared products.') }
        }
      }),
    ).then((results) => {
      if (cancelled) return
      const loaded: SharedRow[] = []
      let failure = ''
      for (const result of results) {
        if (!result) continue
        if ('failed' in result) {
          failure = result.failed ?? ''
          continue
        }
        loaded.push(result)
      }
      setRows(loaded)
      setError(loaded.length === 0 ? failure || 'Those shared products are not available.' : '')
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [storeId, targets])

  return (
    <section aria-label="Shared with you">
      <h2 className="font-display text-lg font-semibold text-slate-900">Shared with you</h2>
      <p className="mt-1 text-sm text-slate-500">Products from the link you opened.</p>
      {loading ? (
        <ProductGridSkeleton count={Math.min(targets.length, 4)} className="mt-3" />
      ) : error ? (
        <p className="mt-3 text-sm text-slate-600">{error}</p>
      ) : (
        <ProductGrid
          storeId={storeId}
          storeName={storeName}
          products={rows.map((row) => row.product)}
          hideHeader
          className="mt-3"
          skuForProduct={(product) => rows.find((row) => row.product.id === product.id)?.skuId}
        />
      )}
    </section>
  )
}
