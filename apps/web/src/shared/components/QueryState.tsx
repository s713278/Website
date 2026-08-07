import type { ReactNode } from 'react';
import { getErrorMessage } from '@mithra/api-client';
import { Skeleton } from '@/shared/components/ui/skeleton';

type QueryStateProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
  onRetry: () => void;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
};

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  onRetry,
  loadingLabel = 'Loading',
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'No results matched your request.',
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={loadingLabel}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="hidden h-24 sm:block" />
          <Skeleton className="hidden h-24 sm:block" />
        </div>
        <p className="text-center text-sm text-gray-500">{loadingLabel}…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center"
        role="alert"
      >
        <p className="text-sm font-semibold text-red-700">Couldn’t load data</p>
        <p className="mt-1 text-sm text-red-600">
          {getErrorMessage(error, 'Something went wrong. Please try again.')}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-gray-800">{emptyTitle}</p>
        <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
