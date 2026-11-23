import { useMemo } from 'react'
import { savedCatalog, type CatalogLists } from '../lib/onboarding-saved-catalog'
import { useOnboardingStore } from '../store/onboarding-store'

/** The saved catalog (`savedCatalog`), recomputed only when what it reads changes. */
export function useSavedCatalog(): CatalogLists {
  const draft = useOnboardingStore((state) => state.draft)
  const editedSteps = useOnboardingStore((state) => state.editedSteps)
  const fieldEdits = useOnboardingStore((state) => state.fieldEdits)
  const savedBaselines = useOnboardingStore((state) => state.savedBaselines)
  const accountCatalog = useOnboardingStore((state) => state.accountCatalog)
  return useMemo(
    () => savedCatalog({ draft, editedSteps, fieldEdits, savedBaselines, accountCatalog }),
    [draft, editedSteps, fieldEdits, savedBaselines, accountCatalog],
  )
}
