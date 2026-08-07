import { useDeferredValue, useMemo, useState } from 'react';
import { QueryState } from '@/shared/components/QueryState';
import { SelectCard } from '@/features/onboarding/components/SelectCard';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingBusinessTypes } from '@/features/onboarding/hooks/use-onboarding-catalog';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepBusinessType() {
  const businessType = useOnboardingStore((s) => s.businessType);
  const businessTypeLabel = useOnboardingStore((s) => s.businessTypeLabel);
  const setBusinessType = useOnboardingStore((s) => s.setBusinessType);
  const error = useOnboardingStore((s) => s.error);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());

  const businessTypesQuery = useOnboardingBusinessTypes({
    keyword: deferredQuery || undefined,
  });

  const items = useMemo(
    () => businessTypesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [businessTypesQuery.data],
  );
  const firstPage = businessTypesQuery.data?.pages[0];
  const total = firstPage?.total ?? items.length;
  const fromFallback = Boolean(firstPage?.fromFallback);
  const selectedLabel =
    businessTypeLabel || items.find((b) => String(b.id) === businessType)?.label;

  // Hard error only when the query failed AND we have no pages to show.
  const isHardError = businessTypesQuery.isError && items.length === 0;

  return (
    <StepShell
      title="Choose Your Business"
      description={
        <>
          Pick the option that best matches what you sell. Can&apos;t find yours? Choose{' '}
          <strong>Others</strong>.
        </>
      }
      error={error}
      footer={<StepNav />}
    >
      <div className="mb-4">
        <label htmlFor="business-search" className="mb-1.5 block text-sm font-medium text-gray-700">
          Search business type
        </label>
        <div className="relative">
          <input
            id="business-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search e.g. bakery, pickles, dairy…"
            autoComplete="off"
            enterKeyHint="search"
            aria-controls="business-grid"
            className="w-full rounded-xl border border-gray-200 py-3 pl-4 pr-10 focus:border-[var(--store-theme,var(--md-green))] focus:outline-none focus:ring-2 focus:ring-[var(--store-theme-soft)]"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setQuery('')}
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          {items.length || total ? (
            <span>
              Showing {items.length}
              {total ? ` of ${total}` : ''}
            </span>
          ) : null}
          {selectedLabel ? (
            <span className="font-medium text-[var(--md-green-deep)]">Selected: {selectedLabel}</span>
          ) : null}
        </div>
      </div>

      {fromFallback ? (
        <p className="ob-fallback-note" role="status">
          Showing offline business types.{' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void businessTypesQuery.refetch()}
          >
            Retry server catalog
          </button>
        </p>
      ) : null}

      <QueryState
        isLoading={businessTypesQuery.isLoading && items.length === 0}
        isError={isHardError}
        error={businessTypesQuery.error}
        isEmpty={
          !businessTypesQuery.isLoading && !isHardError && items.length === 0
        }
        onRetry={() => void businessTypesQuery.refetch()}
        loadingLabel="Loading business types"
        emptyTitle="No business types found"
        emptyDescription={
          deferredQuery
            ? 'No business types match your search. Try another word or choose Others.'
            : 'The catalog is empty right now. Retry or try again later.'
        }
      >
        <div className="ob-biz-scroll max-h-80 overflow-y-auto pr-1">
          <div
            id="business-grid"
            role="listbox"
            aria-label="Business types"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {items.map((b) => (
              <SelectCard
                key={String(b.id)}
                icon={b.icon}
                label={b.label}
                selected={businessType === String(b.id)}
                onSelect={() => setBusinessType(b.id, b.label)}
              />
            ))}
          </div>

          {businessTypesQuery.hasNextPage ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-gray-500">Scroll to see more business types</p>
              <button
                type="button"
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={businessTypesQuery.isFetchingNextPage}
                onClick={() => void businessTypesQuery.fetchNextPage()}
                data-cta="load_more_business_types"
              >
                {businessTypesQuery.isFetchingNextPage ? 'Loading more…' : 'Load more types'}
              </button>
            </div>
          ) : items.length > 0 && !fromFallback ? (
            <p className="mt-3 text-center text-xs text-gray-400">
              You’re all caught up — that’s every business type.
            </p>
          ) : null}
        </div>
      </QueryState>
    </StepShell>
  );
}
