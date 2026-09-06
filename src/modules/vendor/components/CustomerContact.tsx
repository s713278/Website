import { MessageCircle, Phone } from 'lucide-react'
import {
  callLink,
  formatMobile,
  whatsAppLink,
} from '@/modules/vendor/lib/customer-contact'

/**
 * Who an order belongs to, and how to reach them.
 *
 * The list read supplies only `mobile`; the detail read also supplies a name. This renders
 * whichever it has without pretending one is the other — a phone number never appears as if
 * it were a customer's name, and a missing name says so plainly rather than showing a digit
 * string in its place.
 *
 * Both links are ordinary anchors. Tapping opens the phone's dialler or WhatsApp; nothing
 * is sent, and no message is prefilled.
 */
export function CustomerContact({
  name,
  mobile,
  className,
}: {
  name: string | null
  mobile: string | null
  className?: string
}) {
  const call = callLink(mobile)
  const whatsApp = whatsAppLink(mobile)
  const readable = formatMobile(mobile)

  return (
    <div className={className}>
      <p className="text-sm text-[var(--md-muted)]">
        {name ?? (readable ? readable : 'No contact details')}
      </p>

      {call || whatsApp ? (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {/* Shown under the name when both exist, so the number is still reachable. */}
          {name && readable ? (
            <span className="text-sm text-[var(--md-muted)]">{readable}</span>
          ) : null}
          {call ? (
            <a
              href={call}
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--md-green-700)] hover:underline"
            >
              <Phone className="size-4" aria-hidden />
              Call
            </a>
          ) : null}
          {whatsApp ? (
            <a
              href={whatsApp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--md-green-700)] hover:underline"
            >
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
