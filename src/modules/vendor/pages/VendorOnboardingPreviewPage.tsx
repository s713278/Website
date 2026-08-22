import { ArrowLeftIcon, LockKeyholeIcon, StoreIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button, Spinner } from '@/shared/components/ui'
import { StorefrontPreview } from '../components/onboarding/StorefrontPreview'
import { useOnboardingDraftSession } from '../hooks/use-onboarding-draft-session'
import { hydratePersistedDraft } from '../lib/onboarding-persistence'
import { useOnboardingStore } from '../store/onboarding-store'

export function VendorOnboardingPreviewPage() {
  const { draftSlug } = useParams()
  const previewSnapshot = useOnboardingStore((state) => state.previewSnapshot)
  const previewRestored = useOnboardingStore((state) => state.previewRestored)
  const logoUrl = useOnboardingStore((state) => state.runtime.logoUrl)
  const bannerUrl = useOnboardingStore((state) => state.runtime.bannerUrl)

  // The snapshot travels inside the draft envelope, so the same ownership rule applies:
  // a preview belongs to the vendor who produced it, not to whoever opens the link.
  const { ready } = useOnboardingDraftSession()

  if (!ready) {
    return <main className="grid min-h-[100dvh] place-items-center bg-background"><Spinner label="Opening private preview…" /></main>
  }

  if (!previewSnapshot || previewSnapshot.slug !== draftSlug) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
        <div className="max-w-md rounded-xl border bg-card p-7 text-center shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)]">
          <div className="mx-auto grid size-11 place-items-center rounded-lg bg-muted"><StoreIcon className="size-5 text-muted-foreground" /></div>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em]">Private preview not found</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">This browser does not have a completed onboarding preview matching that link.</p>
          <Button className="mt-5" asChild><Link to="/onboarding"><ArrowLeftIcon /> Return to onboarding</Link></Button>
        </div>
      </main>
    )
  }

  const previewDraft = hydratePersistedDraft(previewSnapshot.draft)

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b border-amber-300 bg-amber-50/95 backdrop-blur dark:border-amber-800 dark:bg-amber-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 text-amber-950 dark:text-amber-100"><LockKeyholeIcon className="size-5" /><div><strong className="block text-sm">Non-public browser preview</strong><span className="text-xs text-current/75">{previewRestored ? 'Private fields and uploaded images were not restored' : 'Saved only in this browser (not published)'}</span></div></div>
          <Button variant="outline" size="sm" asChild><Link to="/onboarding"><ArrowLeftIcon /> Back to wizard</Link></Button>
        </div>
      </header>
      <main><StorefrontPreview draft={previewDraft} logoUrl={previewRestored ? null : logoUrl} bannerUrl={previewRestored ? null : bannerUrl} fullPage /></main>
    </div>
  )
}
