import { type ReactNode } from 'react'
import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/modules/storefront/components/CategoryIcon'
import {
  ALL_CATEGORY,
  categoryFilterValue,
  isCategoryActive,
  type CategoryFilter,
} from '@/modules/storefront/lib/catalog-filters'
import type { StoreCategory } from '@/modules/storefront/types'
import { SectionHeader } from '@/shared/components'

type CategoryTileProps = {
  category: StoreCategory
  active: boolean
  onSelect: () => void
  className?: string
}

/** Shared circle chrome — All and named categories use the same active/inactive look. */
function CategoryCircle({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'flex size-[3.75rem] items-center justify-center rounded-full sm:size-16',
        active && 'bg-[var(--store-theme-soft,rgba(16,185,129,0.18))]',
      )}
    >
      <span
        className={cn(
          'flex size-14 items-center justify-center overflow-hidden rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.16))] transition-all duration-200 sm:size-[3.75rem]',
          active
            ? 'ring-1 ring-inset ring-[var(--store-theme,var(--md-green-600))]'
            : 'ring-1 ring-inset ring-slate-200/90',
        )}
      >
        {children}
      </span>
    </span>
  )
}

function tileLabelClass(active: boolean) {
  return cn(
    'block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium leading-none text-slate-600',
    active && 'font-semibold text-[var(--store-theme,var(--md-green-700))]',
  )
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
        'group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center sm:w-[4.75rem]',
        className,
      )}
    >
      <CategoryCircle active={active}>
        <LayoutGrid className="size-5 text-slate-800" strokeWidth={1.75} aria-hidden />
      </CategoryCircle>
      <span className={tileLabelClass(active)}>All</span>
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
        'group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center sm:w-[4.75rem]',
        className,
      )}
    >
      <CategoryCircle active={active}>
        <CategoryIcon imagePath={category.imagePath} label={category.label} />
      </CategoryCircle>
      <span className={tileLabelClass(active)}>{category.label}</span>
    </button>
  )
}

type CategoryScrollerProps = {
  categories: StoreCategory[]
  activeFilter: CategoryFilter
  onSelect: (filter: CategoryFilter) => void
  onViewAll?: () => void
  actionLabel?: string
  showAllOption?: boolean
  className?: string
}

export function CategoryScroller({
  categories,
  activeFilter,
  onSelect,
  onViewAll,
  actionLabel = 'View all',
  showAllOption = false,
  className,
}: CategoryScrollerProps) {
  const allActive = showAllOption && activeFilter === ALL_CATEGORY

  return (
    <section className={cn(className)}>
      <SectionHeader
        compact
        title="Shop by Category"
        actionLabel={onViewAll ? actionLabel : undefined}
        onAction={onViewAll}
        titleClassName="whitespace-nowrap"
      />

      <div className="store-category-scroller flex gap-3 overflow-x-auto px-0.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3.5 lg:gap-4">
        {showAllOption ? (
          <AllCategoryTile
            active={allActive}
            onSelect={() => onSelect(ALL_CATEGORY)}
            className="snap-start"
          />
        ) : null}
        {categories.map((category) => (
          <CategoryTile
            key={category.label}
            category={category}
            active={isCategoryActive(activeFilter, category)}
            onSelect={() => onSelect(categoryFilterValue(category))}
            className="snap-start"
          />
        ))}
      </div>
    </section>
  )
}
