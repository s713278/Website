import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'

/**
 * The cart icon every header shows. The caller decides whether it shows at all (only where
 * the session can hold a cart) and which cart it opens.
 */
export function CartButton({ to, count }: { to: string; count: number }) {
  return (
    <Link
      to={to}
      className="relative inline-flex size-11 shrink-0 items-center justify-center overflow-visible rounded-full text-slate-700 transition hover:bg-slate-100"
      aria-label={`Cart${count ? `, ${count} items` : ''}`}
    >
      <ShoppingCart className="size-[1.125rem]" strokeWidth={1.75} />
      {count > 0 ? (
        <span className="absolute right-1.5 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--store-theme,var(--md-green-600))] px-0.5 text-[9px] font-bold leading-none text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  )
}
