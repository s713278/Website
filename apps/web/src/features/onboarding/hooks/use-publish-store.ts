import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '@mithra/api-client';
import { publishStoreSetup } from '@/features/onboarding/api/vendor';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { queryKeys } from '@/shared/api/query-keys';

/** Publish store with optimistic step advance + snapshot rollback on failure. */
export function usePublishStoreSetup() {
  const qc = useQueryClient();
  const getDraftSnapshot = useOnboardingStore((s) => s.getDraftSnapshot);
  const applyPublishSuccess = useOnboardingStore((s) => s.applyPublishSuccess);
  const restoreSnapshot = useOnboardingStore((s) => s.restoreSnapshot);
  const setPublishError = useOnboardingStore((s) => s.setPublishError);
  const clearError = useOnboardingStore((s) => s.clearError);
  const persistDraftNow = useOnboardingStore((s) => s.persistDraftNow);

  return useMutation({
    mutationFn: () => publishStoreSetup(getDraftSnapshot()),
    onMutate: async () => {
      clearError();
      const snapshot = getDraftSnapshot();
      useOnboardingStore.setState({
        published: true,
        currentStep: 10,
        maxReachedStep: 10,
        publishError: '',
        error: '',
      });
      return { snapshot };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.snapshot) restoreSnapshot({ ...ctx.snapshot, currentStep: 9 });
      setPublishError(getErrorMessage(error, 'Failed to publish. You can retry Go Live.'));
    },
    onSuccess: async (result) => {
      applyPublishSuccess(result.vendorId);
      persistDraftNow();
      if (result.vendorId) {
        await qc.invalidateQueries({ queryKey: queryKeys.vendors.detail(result.vendorId) });
      }
    },
  });
}
