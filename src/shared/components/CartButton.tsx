import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'

/**
 * The cart icon every header shows. The caller decides where it goes (the cart, or the
 * customer login for a live shopper who is not signed in) and which count may be shown.
 */
export function CartButton({ to, state, count }: { to: string; state?: unknown; count: number }) {
  return (
    <Link
      to={to}
      state={state}
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
