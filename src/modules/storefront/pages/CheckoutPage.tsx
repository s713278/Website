import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ordersService } from '@/shared/api'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { getErrorMessage } from '@/shared/api'
import { Button, Card, Input, PageHeader } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

export function CheckoutPage() {
  const navigate = useNavigate()
  const lines = useCartStore((s) => s.lines)
  const subtotal = useCartStore((s) => s.subtotal())
  const clear = useCartStore((s) => s.clear)
  const deliveryFee = 29
  const total = subtotal + deliveryFee
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  if (!lines.length) return <Navigate to="/cart" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPlacing(true)
    setError('')
    try {
      await ordersService.placeOrder({
        storeId: lines[0].storeId,
        storeName: lines[0].storeName,
        address,
        phone,
        note,
        lines,
        deliveryFee,
        total,
      })
      clear()
      navigate('/orders', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not place order'))
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Checkout" subtitle="Confirm delivery details" />
      <form className="grid gap-6 md:grid-cols-[1.4fr_1fr]" onSubmit={onSubmit}>
        <Card className="space-y-4">
          <Input
            label="Delivery address"
            name="address"
            required
            placeholder="Flat, street, landmark"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            required
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Note for store (optional)"
            name="note"
            placeholder="Delivery instructions…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Card>
        <Card className="h-fit space-y-3">
          <h2 className="font-display font-semibold">Order summary</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            {lines.map((line) => (
              <li key={line.itemId} className="flex justify-between gap-2">
                <span>
                  {line.qty}× {line.name}
                </span>
                <span>{formatCurrency(line.price * line.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-[var(--md-border)] pt-2 text-sm">
            <span>Delivery</span>
            <span>{formatCurrency(deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {error ? <p className="text-sm text-[var(--md-danger)]">{error}</p> : null}
          <Button type="submit" fullWidth disabled={placing}>
            {placing ? 'Placing order…' : 'Place order'}
          </Button>
          <Link to="/cart" className="block text-center text-sm text-[var(--md-muted)]">
            Back to cart
          </Link>
        </Card>
      </form>
    </div>
  )
}
