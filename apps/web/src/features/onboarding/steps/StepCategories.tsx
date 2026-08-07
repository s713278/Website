import { useState } from 'react';
import { QueryState } from '@/shared/components/QueryState';
import { SelectCard } from '@/features/onboarding/components/SelectCard';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingCategories } from '@/features/onboarding/hooks/use-onboarding-catalog';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepCategories() {
  const businessType = useOnboardingStore((s) => s.businessType);
  const categories = useOnboardingStore((s) => s.categories);
  const toggleCategory = useOnboardingStore((s) => s.toggleCategory);
  const addCustomCategory = useOnboardingStore((s) => s.addCustomCategory);
  const error = useOnboardingStore((s) => s.error);
  const [customName, setCustomName] = useState('');

  const categoriesQuery = useOnboardingCategories(businessType || null);

  const apiCategories = categoriesQuery.data?.items ?? [];
  const fromFallback = Boolean(categoriesQuery.data?.fromFallback);
  const extras = categories.filter((c) => !apiCategories.some((a) => String(a.id) === String(c.id)));
  const options = [
    ...apiCategories.map((c) => ({ id: c.id, name: c.name })),
    ...extras,
  ];

  const isHardError = categoriesQuery.isError && options.length === 0;

  return (
    <StepShell
      title="Pick Categories"
      description={
        <>
          Choose up to <strong>2</strong> — start small, add more later from your dashboard.
        </>
      }
      error={error}
      footer={<StepNav />}
    >
      {fromFallback ? (
        <p className="ob-fallback-note" role="status">
          Showing offline categories.{' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void categoriesQuery.refetch()}
          >
            Retry server catalog
          </button>
        </p>
      ) : null}

      <QueryState
        isLoading={categoriesQuery.isLoading && !categoriesQuery.data}
        isError={isHardError}
        error={categoriesQuery.error}
        isEmpty={
          !categoriesQuery.isLoading &&
          !isHardError &&
          apiCategories.length === 0 &&
          extras.length === 0
        }
        onRetry={() => void categoriesQuery.refetch()}
        loadingLabel="Loading categories"
        emptyTitle="No categories for this business"
        emptyDescription="Try another business type, or add a custom category below."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Categories">
          {options.map((cat) => {
            const selected = categories.some((c) => String(c.id) === String(cat.id));
            return (
              <SelectCard
                key={String(cat.id)}
                role="checkbox"
                aria-checked={selected}
                label={cat.name}
                selected={selected}
                onSelect={() => toggleCategory(cat)}
              />
            );
          })}
        </div>
      </QueryState>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="new-category" className="sr-only">
          Custom category name
        </label>
        <input
          id="new-category"
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Custom category name"
          className="max-w-xs rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--store-theme-soft)]"
        />
        <button
          type="button"
          className="rounded-xl border border-[color-mix(in_srgb,var(--store-theme)_35%,#e5e7eb)] px-3 py-2 text-sm font-medium text-[var(--md-green-deep)] hover:bg-[var(--md-green-soft)]"
          onClick={() => {
            addCustomCategory(customName);
            setCustomName('');
          }}
        >
          + Add Category
        </button>
      </div>
    </StepShell>
  );
}
