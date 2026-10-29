import type { VendorCatalogPreview } from '@/shared/api'
import type { CatalogSource, OnboardingStep } from '../types/onboarding'

/** The parts of the phone preview the account summary shows instead of the draft. */
export type PhonePreviewAccountParts = {
  categories?: { id: number; name: string }[]
  products?: { id: number; name: string; imageUrl: string | null; price?: number }[]
  sizes?: number
}

/**
 * Which phone preview parts come from the context's catalog summary.
 *
 * A part does while its step (categories 4, products 5, sizes 6) has neither been read
 * into the draft this visit nor edited locally; otherwise the draft is newer. A sample
 * catalog, or a context without the summary, uses the draft throughout.
 */
export function phonePreviewAccountParts(state: {
  catalogSource: CatalogSource
  catalogPreview: VendorCatalogPreview | null
  loadedSteps: readonly OnboardingStep[]
  editedSteps: readonly OnboardingStep[]
}): PhonePreviewAccountParts {
  const summary = state.catalogPreview
  if (state.catalogSource !== 'account' || !summary) return {}
  const unread = (step: OnboardingStep) => !state.loadedSteps.includes(step) && !state.editedSteps.includes(step)
  return {
    ...(unread(4) ? { categories: summary.categories } : {}),
    ...(unread(5)
      ? { products: summary.products.map(({ id, name, imageUrl, price }) => ({ id, name, imageUrl, price: price ?? undefined })) }
      : {}),
    ...(unread(6) ? { sizes: summary.activeSkuCount } : {}),
  }
}
