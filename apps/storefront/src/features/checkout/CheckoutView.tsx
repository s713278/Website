import { useEffect, useState } from 'react';
import { checkDeliveryEligibility, createOrderFromCart, ApiError } from '@mithra/api-client';
import {
  buildWhatsAppOrderMessage,
  formatEligibilityMessage,
  formatMoney,
  generateClientOrderId,
  resolveCheckoutChannel,
  whatsappLink,
} from '@mithra/domain';
import { Button } from '@mithra/ui';
import { CHECKOUT_CHANNEL, SAMPLE_VENDOR_ID, USE_API } from '../../config';
import { useStore } from '../home/store-context';

export function CheckoutView() {
  const {
    draft,
    vendorId,
    cart,
    address,
    setAddress,
    addressId,
    setAddressId,
    pincode,
    customer,
    subtotal,
    deliveryCharge,
    discount,
    grandTotal,
    setOrderId,
    setOrderMessage,
    clearCart,
    setView,
  } = useStore();
  const [pay, setPay] = useState('cod');
  const [terms, setTerms] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [eligHint, setEligHint] = useState('');

  const addresses = draft.addresses || [
    { id: 'home', label: 'Home', line: address || draft.settings.address || '' },
  ];

  const effectiveVendorId = vendorId || (SAMPLE_VENDOR_ID > 0 ? SAMPLE_VENDOR_ID : null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!USE_API || !effectiveVendorId || !pincode) {
        setEligHint('');
        return;
      }
      try {
        const res = await checkDeliveryEligibility(effectiveVendorId, {
          pincode,
          formatted_address: address || '',
        });
        const data = res.data || (res as unknown as { deliverable?: boolean; reason?: string });
        if (!cancelled) setEligHint(formatEligibilityMessage(data));
      } catch {
        if (!cancelled) setEligHint('');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [USE_API, effectiveVendorId, pincode, address]);

  async function createOrder() {
    setError('');
    if (!terms) {
      setError('Please agree to the Terms & Conditions.');
      return;
    }
    if (!cart.length) {
      setView('menu');
      return;
    }

    setBusy(true);
    try {
      const payLabel =
        pay === 'upi' ? 'UPI / Card' : pay === 'other' ? 'Other' : 'Pay on Delivery (Cash)';

      let orderId = generateClientOrderId();
      const channel = resolveCheckoutChannel(CHECKOUT_CHANNEL);

      const deliveryMethod =
        draft.delivery?.homeDelivery?.enabled !== false ? 'HOME_DELIVERY' : 'STORE_PICKUP';

      if (USE_API && effectiveVendorId) {
        const res = await createOrderFromCart({
          vendor_id: effectiveVendorId,
          delivery_method: deliveryMethod,
          clear_cart: true,
          order_source: channel === 'CLOUD_API' ? 'WHATSAPP_CLOUD' : 'WHATSAPP_DEEPLINK',
          notes: `Payment preference: ${payLabel}; Address: ${address || ''}; Pincode: ${pincode || ''}`,
        });
        const data = res.data as { order_id?: number | string } | undefined;
        if (data?.order_id) orderId = String(data.order_id);
      }

      const message = buildWhatsAppOrderMessage({
        storeName: draft.settings.storeName,
        orderId,
        customerName: customer.name || 'Guest',
        customerPhone: customer.phone,
        address: address || draft.settings.address || '',
        paymentLabel: payLabel,
        lines: cart.map((l) => ({
          name: l.name,
          label: l.label,
          qty: l.qty,
          price: l.price,
        })),
        subtotal,
        delivery: deliveryCharge,
        discount,
        total: grandTotal,
      });

      setOrderId(orderId);
      setOrderMessage(message);
      clearCart();
      setView('success');

      if (channel === 'DEEPLINK') {
        const wa = draft.settings.whatsapp || draft.phone || '';
        const link = whatsappLink(wa, message);
        setTimeout(() => window.open(link, '_blank', 'noopener'), 400);
      }
      // CLOUD_API: backend /v1/whatsapp webhook + template sender handles outbound
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <h2 className="md-display text-xl">Review Order</h2>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <section className="mt-4 rounded-xl border border-slate-100 p-3">
        <h3 className="font-semibold">Delivery Address</h3>
        {eligHint ? <p className="mt-1 text-xs text-emerald-700">{eligHint}</p> : null}
        <div className="mt-2 space-y-2">
          {addresses.map((a) => (
            <label key={a.id} className="flex gap-2 rounded-lg border border-slate-100 p-2 text-sm">
              <input
                type="radio"
                name="delivery-addr"
                checked={addressId === a.id}
                onChange={() => {
                  setAddressId(a.id);
                  setAddress(a.line);
                }}
              />
              <span>
                <strong>{a.label}</strong>
                <br />
                {a.line}
              </span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-emerald-700"
          onClick={() => {
            const next = window.prompt('Enter delivery address', address);
            if (next?.trim()) setAddress(next.trim());
          }}
        >
          + Add New Address
        </button>
      </section>

      <section className="mt-4 rounded-xl border border-slate-100 p-3">
        <h3 className="mb-2 font-semibold">Order Summary</h3>
        {cart.map((l) => (
          <div key={l.skuId} className="flex justify-between text-sm">
            <span>
              {l.name} ({l.label}) × {l.qty}
            </span>
            <span>{formatMoney(l.price * l.qty)}</span>
          </div>
        ))}
        <div className="mt-2 border-t border-slate-100 pt-2 text-sm font-bold">
          Total {formatMoney(grandTotal)}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-100 p-3">
        <h3 className="mb-2 font-semibold">Payment Preference</h3>
        {(
          [
            ['cod', 'Pay on Delivery (Cash)'],
            ['upi', 'UPI / Card'],
            ['other', 'Other'],
          ] as const
        ).map(([v, label]) => (
          <label key={v} className="mb-2 flex items-center gap-2 text-sm">
            <input type="radio" name="pay" checked={pay === v} onChange={() => setPay(v)} />
            {label}
          </label>
        ))}
      </section>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>I agree to the Terms & Conditions and confirm this order details are correct.</span>
      </label>

      <Button
        className="mt-6 w-full"
        disabled={busy}
        data-cta="create_order_whatsapp"
        onClick={createOrder}
      >
        Create Order & Send on WhatsApp
      </Button>
    </div>
  );
}
