import { hasStrikethroughPrice } from '@/modules/storefront/lib/product-price'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/lib/utils'

const saleSizes = {
  sm: 'text-sm font-bold text-slate-900',
  md: 'text-base font-bold text-slate-900',
  lg: 'text-2xl font-bold text-slate-900 sm:text-[1.75rem]',
} as const

const mrpSizes = {
  sm: 'text-[11px] font-normal text-slate-400 line-through decoration-slate-400',
  md: 'text-xs font-normal text-slate-400 line-through decoration-slate-400',
  lg: 'text-sm font-normal text-slate-400 line-through decoration-slate-400',
} as const

type ProductPriceProps = {
  /** `sale_price` — the amount the customer pays. */
  price: number
  /** `list_price` — MRP, shown struck through when higher than sale. */
  listPrice?: number
  size?: keyof typeof saleSizes
  className?: string
  saleClassName?: string
}

/** Blinkit-style pair: sale amount + strikethrough MRP. */
export function ProductPrice({
  price,
  listPrice,
  size = 'md',
  className,
  saleClassName,
}: ProductPriceProps) {
  const showMrp = hasStrikethroughPrice(price, listPrice)
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5', className)}>
      <span className={cn(saleSizes[size], saleClassName)}>{formatCurrency(price)}</span>
      {showMrp ? <span className={mrpSizes[size]}>{formatCurrency(listPrice)}</span> : null}
    </span>
  )
}
