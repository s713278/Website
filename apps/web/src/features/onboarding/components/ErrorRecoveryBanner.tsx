import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { usePublishStoreSetup } from '@/features/onboarding/hooks/use-publish-store';

export function ErrorRecoveryBanner() {
  const publishError = useOnboardingStore((s) => s.publishError);
  const clearError = useOnboardingStore((s) => s.clearError);
  const persistDraftNow = useOnboardingStore((s) => s.persistDraftNow);
  const publish = usePublishStoreSetup();

  if (!publishError && !publish.isError) return null;

  const message = publishError || 'Something went wrong while publishing.';

  return (
    <div
      className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3"
      role="alert"
    >
      <p className="text-sm font-semibold text-red-700">Couldn’t finish setup</p>
      <p className="mt-1 text-sm text-red-600">{message}</p>
      <p className="mt-1 text-xs text-red-500">
        Your draft is still on this device — you can retry without losing progress.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={publish.isPending}
          onClick={() => publish.mutate()}
          className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {publish.isPending ? 'Retrying…' : 'Retry Go Live'}
        </button>
        <button
          type="button"
          onClick={() => persistDraftNow()}
          className="rounded-full border border-red-200 px-4 py-1.5 text-sm font-semibold text-red-700 hover:bg-white"
        >
          Save draft now
        </button>
        <button
          type="button"
          onClick={() => clearError()}
          className="rounded-full px-4 py-1.5 text-sm font-medium text-red-600 hover:underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
