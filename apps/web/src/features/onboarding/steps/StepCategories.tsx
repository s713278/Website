import { useState } from 'react';
import { QueryState } from '@/features/onboarding/components/QueryState';
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

  const businessTypeId = Number(businessType) || null;
  const categoriesQuery = useOnboardingCategories(businessTypeId);

  const apiCategories = categoriesQuery.data?.items ?? [];
  const extras = categories.filter((c) => !apiCategories.some((a) => String(a.id) === String(c.id)));
  const options = [
    ...apiCategories.map((c) => ({ id: c.id, name: c.name })),
    ...extras,
  ];

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
      <QueryState
        isLoading={categoriesQuery.isLoading && !categoriesQuery.data}
        isError={categoriesQuery.isError}
        error={categoriesQuery.error}
        isEmpty={
          !categoriesQuery.isLoading &&
          !categoriesQuery.isError &&
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
          className="max-w-xs rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <button
          type="button"
          className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
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
