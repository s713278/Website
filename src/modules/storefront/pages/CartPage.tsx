import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { catalogService } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { loginPathForRole } from '@/app/router/role-home'
import { Button, Card, PageHeader } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

export function CartPage() {
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const user = useAuthStore((s) => s.user)
  const subtotal = useCartStore((s) => s.subtotal())
  const deliveryFee = lines.length ? 29 : 0
  const total = subtotal + deliveryFee

  if (!lines.length) {
    return <EmptyCart name={user?.role === 'customer' ? user.name : undefined} />
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Cart" subtitle={`From ${lines[0].storeName}`} />
      <div className="space-y-3">
        {lines.map((line) => (
          <Card key={line.itemId} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{line.name}</p>
              <p className="text-sm text-[var(--md-muted)]">{formatCurrency(line.price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setQty(line.itemId, line.qty - 1)}>
                −
              </Button>
              <span className="w-6 text-center font-semibold">{line.qty}</span>
              <Button size="sm" variant="secondary" onClick={() => setQty(line.itemId, line.qty + 1)}>
                +
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeItem(line.itemId)}>
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Delivery fee</span>
          <span>{formatCurrency(deliveryFee)}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--md-border)] pt-2 font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {user?.role === 'vendor' ? (
          <Link to={loginPathForRole('customer')} state={{ from: '/checkout' }} className="mt-3 block">
            <Button fullWidth>Sign in as customer to checkout</Button>
          </Link>
        ) : (
          <Link to="/checkout" className="mt-3 block">
            <Button fullWidth>Proceed to checkout</Button>
          </Link>
        )}
      </Card>
    </div>
  )
}

function EmptyCart({ name }: { name?: string }) {
  const [stores, setStores] = useState<Store[]>([])

  useEffect(() => {
    let cancelled = false
    void catalogService
      .listStores()
      .then((data) => {
        if (!cancelled) setStores(data.slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) setStores([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white px-6 py-14 text-center shadow-sm">
        <span className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <ShoppingBag className="size-8" />
        </span>
        <h1 className="font-display mt-5 text-3xl font-bold text-slate-900">Your Mithra cart is empty</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          {name ? `Welcome, ${name}. ` : ''}
          Add something from a neighbourhood store — like Amazon, but local.
        </p>
        <Link to="/stores" className="mt-6 inline-block">
          <Button className="rounded-full px-8">Continue shopping</Button>
        </Link>
      </div>

      {stores.length > 0 ? (
        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold">Recommended stores</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {stores.map((store) => (
              <Link key={store.id} to={`/stores/${store.id}`}>
                <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <p className="font-semibold">{store.name}</p>
                  <p className="mt-1 text-sm text-[var(--md-muted)]">{store.category}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
