import { useMemo, useState } from 'react';
import { SelectCard } from '@/features/onboarding/components/SelectCard';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_PAGE_SIZE,
} from '@/features/onboarding/data/constants';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepBusinessType() {
  const businessType = useOnboardingStore((s) => s.businessType);
  const setBusinessType = useOnboardingStore((s) => s.setBusinessType);
  const error = useOnboardingStore((s) => s.error);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BUSINESS_TYPES;
    return BUSINESS_TYPES.filter((b) =>
      [b.id, b.label, b.keywords].join(' ').toLowerCase().includes(q),
    );
  }, [query]);

  const visible = filtered.slice(0, page * BUSINESS_TYPE_PAGE_SIZE);
  const hasMore = visible.length < filtered.length;
  const selected = BUSINESS_TYPES.find((b) => b.id === businessType);

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
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
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
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          <span>
            Showing {visible.length} of {filtered.length}
          </span>
          {selected ? (
            <span className="font-medium text-emerald-700">Selected: {selected.label}</span>
          ) : null}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto pr-1">
        {visible.length ? (
          <div
            id="business-grid"
            role="listbox"
            aria-label="Business types"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {visible.map((b) => (
              <SelectCard
                key={b.id}
                icon={b.icon}
                label={b.label}
                selected={businessType === b.id}
                onSelect={() => setBusinessType(b.id)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            No business types match your search. Try another word or choose <strong>Others</strong>.
          </p>
        )}
        {hasMore ? (
          <div className="mt-4 text-center">
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => setPage((p) => p + 1)}
            >
              Load more types
            </button>
          </div>
        ) : null}
      </div>
    </StepShell>
  );
}
