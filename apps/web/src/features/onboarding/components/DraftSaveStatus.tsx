import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function DraftSaveStatus() {
  const status = useOnboardingStore((s) => s.saveStatus);
  const lastSavedAt = useOnboardingStore((s) => s.lastSavedAt);
  const persistDraftNow = useOnboardingStore((s) => s.persistDraftNow);

  const time =
    lastSavedAt &&
    new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
      {status === 'saving' ? (
        <span className="font-medium text-amber-700">Saving draft…</span>
      ) : null}
      {status === 'saved' ? (
        <span className="font-medium text-emerald-700">
          Draft saved{time ? ` · ${time}` : ''}
        </span>
      ) : null}
      {status === 'error' ? (
        <>
          <span className="font-medium text-red-600">Draft save failed</span>
          <button
            type="button"
            onClick={() => persistDraftNow()}
            className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
          >
            Retry save
          </button>
        </>
      ) : null}
      {status === 'idle' ? (
        <span className="text-gray-400">Changes autosave locally</span>
      ) : null}
    </div>
  );
}
