import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/modules/storefront/components/CategoryIcon'
import { ALL_CATEGORY } from '@/modules/storefront/lib/catalog-filters'
import type { StoreCategory } from '@/modules/storefront/types'
import { SectionHeader } from '@/shared/components'

type CategoryTileProps = {
  category: StoreCategory
  active: boolean
  onSelect: () => void
  className?: string
}

function AllCategoryTile({
  active,
  onSelect,
  className,
}: {
  active: boolean
  onSelect: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title="All products"
      className={cn(
        'group flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 text-center transition-transform duration-200 hover:-translate-y-0.5 sm:w-[5rem]',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-14 items-center justify-center overflow-hidden rounded-xl border border-slate-100/90 bg-slate-50 text-slate-700 transition-all duration-200 sm:size-[3.75rem]',
          active
            ? 'border-[var(--store-theme,var(--md-green-500))] text-[var(--store-theme,var(--md-green-700))] shadow-[inset_0_0_0_1px_var(--store-theme-muted)]'
            : 'group-hover:border-[color-mix(in_srgb,var(--store-theme,var(--md-green-500))_35%,transparent)]',
        )}
      >
        <LayoutGrid className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span
        className={cn(
          'block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium leading-none text-slate-600 sm:text-[11px]',
          active && 'font-semibold text-[var(--store-theme,var(--md-green-700))]',
        )}
      >
        All
      </span>
    </button>
  )
}

function CategoryTile({ category, active, onSelect, className }: CategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={category.label}
      className={cn(
        'group flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 text-center transition-transform duration-200 hover:-translate-y-0.5 sm:w-[5rem]',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-14 items-center justify-center overflow-hidden rounded-xl border bg-slate-50 transition-all duration-200 sm:size-[3.75rem]',
          active
            ? 'border-[var(--store-theme,var(--md-green-500))] shadow-[inset_0_0_0_1px_var(--store-theme-muted)]'
            : 'border-slate-100/90 group-hover:border-[color-mix(in_srgb,var(--store-theme,var(--md-green-500))_35%,transparent)]',
        )}
      >
        <CategoryIcon imagePath={category.imagePath} label={category.label} />
      </span>
      <span
        className={cn(
          'block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium leading-none text-slate-600 sm:text-[11px]',
          active && 'font-semibold text-[var(--store-theme,var(--md-green-700))]',
        )}
      >
        {category.label}
      </span>
    </button>
  )
}

type CategoryScrollerProps = {
  categories: StoreCategory[]
  activeId: string
  onSelect: (id: string) => void
  onViewAll?: () => void
  actionLabel?: string
  showAllOption?: boolean
  className?: string
}

export function CategoryScroller({
  categories,
  activeId,
  onSelect,
  onViewAll,
  actionLabel = 'View all',
  showAllOption = false,
  className,
}: CategoryScrollerProps) {
  const allActive = showAllOption && activeId === ALL_CATEGORY

  return (
    <section className={cn(className)}>
      <SectionHeader
        compact
        title="Shop by Category"
        actionLabel={onViewAll ? actionLabel : undefined}
        onAction={onViewAll}
        titleClassName="whitespace-nowrap"
      />

      <div className="store-category-scroller flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2.5 lg:gap-3 lg:overflow-visible lg:pb-0">
        {showAllOption ? (
          <AllCategoryTile
            active={allActive}
            onSelect={() => onSelect(ALL_CATEGORY)}
            className="snap-start lg:w-auto lg:min-w-0 lg:flex-1"
          />
        ) : null}
        {categories.map((category) => (
          <CategoryTile
            key={category.id}
            category={category}
            active={activeId === category.id}
            onSelect={() => onSelect(category.id)}
            className="snap-start lg:w-auto lg:min-w-0 lg:flex-1"
          />
        ))}
      </div>
    </section>
  )
}
