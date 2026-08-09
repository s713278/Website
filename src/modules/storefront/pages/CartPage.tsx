import { Link } from 'react-router-dom'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { Button, Card, EmptyState, PageHeader } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

export function CartPage() {
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const subtotal = useCartStore((s) => s.subtotal())
  const deliveryFee = lines.length ? 29 : 0
  const total = subtotal + deliveryFee

  if (!lines.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="Your cart is empty"
          description="Browse stores and add something you like."
          action={
            <Link to="/stores">
              <Button>Explore stores</Button>
            </Link>
          }
        />
      </div>
    )
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
        <Link to="/checkout" className="mt-3 block">
          <Button fullWidth>Proceed to checkout</Button>
        </Link>
      </Card>
    </div>
  )
}
