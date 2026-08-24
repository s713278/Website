import { cn } from '@/lib/utils'
import { useOnboardingStore } from '../../store/onboarding-store'
import { validateDraftSku } from '../../lib/onboarding-validation'

/**
 * What the shop amounts to so far, in three numbers.
 *
 * Deliberately just the counts a vendor is building toward — categories, products,
 * sizes. The preview above already shows what the shop looks like; anything more here
 * competes with it.
 */
export function PreviewStats({ className }: { className?: string }) {
  const categories = useOnboardingStore((state) => state.draft.categories.length)
  const products = useOnboardingStore((state) => state.draft.products.length)
  const skus = useOnboardingStore((state) => state.draft.skus)

  // A size counts once it could actually be sold, which is the same bar Step 6 sets.
  const configured = skus.filter(
    (sku) => sku.active && validateDraftSku(sku, skus.filter((sibling) => sibling.productId === sku.productId)).length === 0,
  ).length

  const stats = [
    { key: 'categories', label: 'Categories', value: categories },
    { key: 'products', label: 'Products', value: products },
    { key: 'sizes', label: 'Sizes', value: configured },
  ]

  return (
    <dl className={cn('grid w-full max-w-[17.5rem] grid-cols-3 gap-2 text-center', className)}>
      {stats.map((stat) => (
        <div key={stat.key}>
          <dd className="ob-numeric font-display text-lg leading-none font-bold text-[var(--ob-ink)]">{stat.value}</dd>
          <dt className="ob-eyebrow mt-1.5 text-[var(--ob-ink-soft)]">{stat.label}</dt>
        </div>
      ))}
    </dl>
  )
}
