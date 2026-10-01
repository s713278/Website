import { ExternalLink, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  findUsAddress,
  hasStoreContactFacts,
  mapsEmbedUrl,
  mapsSearchUrl,
  supportWhatsappHref,
} from '@/modules/storefront/lib/store-contact'
import type { Store } from '@/modules/storefront/types'
import { WhatsAppIcon } from './WhatsAppIcon'

type StoreContactBlockProps = {
  store: Store
  className?: string
}

function CardIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
      {children}
    </span>
  )
}

function SupportChatArt() {
  return (
    <div className="relative mx-auto h-40 w-full max-w-[16rem] sm:h-44" aria-hidden>
      <svg viewBox="0 0 280 176" className="absolute inset-0 size-full">
        <ellipse cx="140" cy="164" rx="78" ry="10" fill="#d7f0e3" />
        <circle cx="52" cy="46" r="18" fill="#e8f8ef" />
        <circle cx="236" cy="128" r="14" fill="#dcfce7" />

        <rect x="96" y="8" width="88" height="148" rx="20" fill="#ffffff" />
        <rect x="96" y="8" width="88" height="148" rx="20" fill="none" stroke="#bbf7d0" strokeWidth="4" />
        <rect x="124" y="16" width="32" height="6" rx="3" fill="#86efac" />
        <rect x="104" y="30" width="72" height="108" rx="10" fill="#ecfdf5" />

        <rect x="112" y="42" width="40" height="18" rx="9" fill="#ffffff" />
        <rect x="128" y="68" width="40" height="18" rx="9" fill="#22c55e" />
        <rect x="112" y="94" width="32" height="18" rx="9" fill="#ffffff" />

        <circle cx="140" cy="150" r="5" fill="#bbf7d0" />
      </svg>
      <span className="absolute right-6 top-3 flex size-10 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-md sm:right-8">
        <WhatsAppIcon className="size-5" />
      </span>
    </div>
  )
}

/** Find us / Support — only facts present on the storefront payload. */
export function StoreContactBlock({ store, className }: StoreContactBlockProps) {
  if (!hasStoreContactFacts(store)) return null

  const address = findUsAddress(store)
  const supportHref = supportWhatsappHref(store)
  const primaryCount = [address, supportHref].filter(Boolean).length

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.18)]',
        className,
      )}
    >
      <div
        className={cn(
          'grid divide-y divide-slate-100 md:divide-x md:divide-y-0',
          primaryCount === 1 && 'md:grid-cols-1',
          primaryCount >= 2 && 'md:grid-cols-2',
        )}
      >
        {address ? (
          <article className="flex flex-col px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex items-start gap-3">
              <CardIcon>
                <MapPin className="size-5" strokeWidth={1.75} aria-hidden />
              </CardIcon>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Find us</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{address}</p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-100">
              <iframe
                title={`Map of ${address}`}
                src={mapsEmbedUrl(address)}
                className="h-40 w-full border-0 sm:h-44"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={mapsSearchUrl(address)}
              target="_blank"
              rel="noreferrer"
              className="mx-auto mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <MapPin className="size-4" strokeWidth={2} aria-hidden />
              Open in Maps
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </article>
        ) : null}

        {supportHref ? (
          <article className="flex flex-col px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex items-start gap-3">
              <CardIcon>
                <WhatsAppIcon className="size-5" />
              </CardIcon>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Support</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                  Need help with an order? Chat with the shop on WhatsApp.
                </p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl bg-[#f4fbf7] ring-1 ring-emerald-50">
              <SupportChatArt />
            </div>
            <a
              href={supportHref}
              target="_blank"
              rel="noreferrer"
              className="mx-auto mt-5 inline-flex min-h-11 w-full max-w-[16rem] items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <WhatsAppIcon className="size-4" />
              WhatsApp us
            </a>
          </article>
        ) : null}
      </div>
    </section>
  )
}
