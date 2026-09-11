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
        'flex size-[3.75rem] shrink-0 items-center justify-center rounded-full p-0.5 sm:size-16',
        active && 'bg-[var(--store-accent-soft,rgba(249,115,22,0.2))]',
      )}
    >
      <span
        className={cn(
          'flex size-full items-center justify-center overflow-hidden rounded-full transition-all duration-200',
          active
            ? 'bg-[var(--store-accent-soft,rgba(249,115,22,0.16))] ring-2 ring-inset ring-[var(--store-accent,#f97316)]'
            : 'bg-[#efe7df] ring-1 ring-inset ring-black/5',
        )}
      >
        {children}
      </span>
    </span>
  )
}

function tileLabelClass(active: boolean) {
  return cn(
    'mt-2.5 block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium leading-tight text-slate-700 sm:text-xs',
    active && 'font-semibold text-[var(--store-accent,#ea580c)]',
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
        'group flex w-[5rem] shrink-0 flex-col items-center text-center sm:w-[5.25rem]',
        className,
      )}
    >
      <CategoryCircle active={active}>
        <LayoutGrid
          className={cn(
            'size-5 transition-colors',
            active ? 'text-[var(--store-accent,#ea580c)]' : 'text-slate-700',
          )}
          strokeWidth={1.75}
          aria-hidden
        />
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
        'group flex w-[5rem] shrink-0 flex-col items-center text-center sm:w-[5.25rem]',
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
        titleClassName="min-w-0 truncate"
      />

      <div className="rounded-2xl bg-[#f4f4f5] px-4 py-4 sm:rounded-[1.25rem] sm:px-5 sm:py-5">
        <div className="store-category-scroller flex gap-5 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6 lg:gap-7">
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
      </div>
    </section>
  )
}
