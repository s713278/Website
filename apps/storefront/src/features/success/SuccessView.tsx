import { whatsappLink } from '@mithra/domain';
import { Button } from '@mithra/ui';
import { CHECKOUT_CHANNEL } from '../../config';
import { useStore } from '../home/store-context';

export function SuccessView() {
  const { draft, orderId, orderMessage, setView } = useStore();
  const wa = draft.settings.whatsapp || draft.phone || '';
  const link = whatsappLink(wa, orderMessage);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center md-fade-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
        ✓
      </div>
      <h2 className="md-display text-2xl">Order Created Successfully!</h2>
      <p className="mt-2 text-sm text-slate-500">Order ID</p>
      <p className="md-display text-xl text-emerald-800">{orderId || '—'}</p>

      {CHECKOUT_CHANNEL === 'CLOUD_API' ? (
        <p className="mt-4 max-w-sm text-sm text-slate-600">
          Cloud API mode: the platform will send a WhatsApp template via <code>/v1/whatsapp</code>. Deep-link
          is still available as fallback.
        </p>
      ) : null}

      <a
        id="btn-send-whatsapp"
        href={link}
        target="_blank"
        rel="noreferrer"
        className="md-btn md-btn-wa mt-6"
        data-cta="send_order_whatsapp"
      >
        Send Order on WhatsApp
      </a>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          variant="outline"
          onClick={() =>
            window.alert(`Order ${orderId}\n\n${orderMessage || 'Order details sent on WhatsApp.'}`)
          }
        >
          View Order Details
        </Button>
        <button type="button" className="text-sm text-slate-500" onClick={() => setView('home')}>
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
