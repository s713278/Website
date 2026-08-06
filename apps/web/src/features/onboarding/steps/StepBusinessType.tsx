import { useDeferredValue, useState } from 'react';
import { QueryState } from '@/features/onboarding/components/QueryState';
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
    pageNumber: 0,
    pageSize: 48,
    keyword: deferredQuery || undefined,
  });

  const items = businessTypesQuery.data?.items ?? [];
  const selectedLabel =
    businessTypeLabel || items.find((b) => String(b.id) === businessType)?.label;

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
            className="w-full rounded-xl border border-gray-200 py-3 pl-4 pr-10 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
          {businessTypesQuery.data ? (
            <span>
              Showing {items.length}
              {businessTypesQuery.data.total ? ` of ${businessTypesQuery.data.total}` : ''}
            </span>
          ) : null}
          {selectedLabel ? (
            <span className="font-medium text-emerald-700">Selected: {selectedLabel}</span>
          ) : null}
        </div>
      </div>

      <QueryState
        isLoading={businessTypesQuery.isLoading && !businessTypesQuery.data}
        isError={businessTypesQuery.isError}
        error={businessTypesQuery.error}
        isEmpty={!businessTypesQuery.isLoading && !businessTypesQuery.isError && items.length === 0}
        onRetry={() => void businessTypesQuery.refetch()}
        loadingLabel="Loading business types"
        emptyTitle="No business types found"
        emptyDescription={
          deferredQuery
            ? 'No business types match your search. Try another word.'
            : 'The catalog is empty right now. Retry or try again later.'
        }
      >
        <div className="max-h-80 overflow-y-auto pr-1">
          <div
            id="business-grid"
            role="listbox"
            aria-label="Business types"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {items.map((b) => (
              <SelectCard
                key={b.id}
                icon={b.icon}
                label={b.label}
                selected={businessType === String(b.id)}
                onSelect={() => setBusinessType(b.id, b.label)}
              />
            ))}
          </div>
        </div>
      </QueryState>
    </StepShell>
  );
}
