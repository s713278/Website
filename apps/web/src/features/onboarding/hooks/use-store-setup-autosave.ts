import { useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

const AUTOSAVE_MS = 500;

/** Hydrate draft from localStorage, then debounce-persist on changes. */
export function useStoreSetupAutosave() {
  const hydrateFromStorage = useOnboardingStore((s) => s.hydrateFromStorage);
  const persistDraftNow = useOnboardingStore((s) => s.persistDraftNow);
  const setSaveStatus = useOnboardingStore((s) => s.setSaveStatus);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!hydrated) return;
    return useOnboardingStore.subscribe((state, prev) => {
      const changed =
        state.phone !== prev.phone ||
        state.verified !== prev.verified ||
        state.businessType !== prev.businessType ||
        state.categories !== prev.categories ||
        state.products !== prev.products ||
        state.delivery !== prev.delivery ||
        state.payment !== prev.payment ||
        state.settings !== prev.settings ||
        state.currentStep !== prev.currentStep ||
        state.vendorId !== prev.vendorId ||
        state.published !== prev.published;

      if (!changed) return;
      setSaveStatus('saving');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        persistDraftNow();
      }, AUTOSAVE_MS);
    });
  }, [hydrated, persistDraftNow, setSaveStatus]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
}
