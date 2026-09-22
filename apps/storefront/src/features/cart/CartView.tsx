import { useState } from 'react';
import { formatMoney } from '@mithra/domain';
import { BillSummary, Button, Field } from '@mithra/ui';
import { useStore } from '../home/store-context';

export function CartView() {
  const {
    cart,
    setQty,
    subtotal,
    deliveryCharge,
    discount,
    setDiscount,
    setCoupon,
    grandTotal,
    setView,
    customer,
  } = useStore();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  function applyCoupon() {
    const c = code.trim().toUpperCase();
    if (c === 'MITHRA50' || c === 'HOME50') {
      const d = Math.min(50, subtotal);
      setDiscount(d);
      setCoupon(c);
      setMsg(`Coupon applied! ₹${d} off`);
    } else if (!c) {
      setDiscount(0);
      setMsg('');
    } else {
      setDiscount(0);
      setMsg('Invalid coupon. Try MITHRA50');
    }
  }

  return (
    <div className="p-4">
      <h2 className="md-display text-xl">Shopping Cart</h2>
      {!cart.length ? (
        <div className="py-12 text-center text-slate-500">
          <p>Your cart is empty</p>
          <Button className="mt-4" onClick={() => setView('menu')}>
            Browse menu
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {cart.map((line) => (
              <div key={line.skuId} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <div
                  className="h-14 w-14 shrink-0 rounded-lg"
                  style={{ background: line.color || '#ecfdf5' }}
                />
                <div className="flex-1">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-semibold">{line.name}</div>
                      <div className="text-xs text-slate-500">{line.label}</div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => setQty(line.skuId, 0)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="qty-stepper">
                      <button type="button" onClick={() => setQty(line.skuId, line.qty - 1)}>
                        −
                      </button>
                      <span className="min-w-[1.25rem] text-center font-semibold">{line.qty}</span>
                      <button type="button" onClick={() => setQty(line.skuId, line.qty + 1)}>
                        +
                      </button>
                    </div>
                    <div className="font-semibold">{formatMoney(line.price * line.qty)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Field
              placeholder="Enter coupon code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Coupon code"
            />
            <Button variant="outline" onClick={applyCoupon}>
              Apply
            </Button>
          </div>
          {msg ? <p className="mt-2 text-sm text-emerald-700">{msg}</p> : null}

          <BillSummary
            lines={[
              { label: 'Subtotal', value: formatMoney(subtotal) },
              { label: 'Delivery', value: formatMoney(deliveryCharge) },
              ...(discount ? [{ label: 'Discount', value: `−${formatMoney(discount)}` }] : []),
              { label: 'Grand Total', value: formatMoney(grandTotal), strong: true },
            ]}
          />

          <Button
            className="mt-6 w-full"
            data-cta="proceed_login"
            onClick={() => setView(customer.loggedIn ? 'checkout' : 'login')}
          >
            Proceed to Login
          </Button>
        </>
      )}
    </div>
  );
}
