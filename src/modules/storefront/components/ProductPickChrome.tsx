import { useEffect, useId, useState } from 'react'
import { Share2, X } from 'lucide-react'
import {
  facebookShareHref,
  INSTAGRAM_URL,
  shareListUrl,
  shareMessage,
  whatsappShareHref,
  type ShareItem,
} from '@/modules/storefront/lib/product-share'
import { productShareCard } from '@/shared/lib/share-preview'
import { cn } from '@/lib/utils'

export function ProductShareButton({
  storeId,
  storeName,
  item,
}: {
  storeId: string
  storeName: string
  item: ShareItem
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="absolute right-2.5 top-2.5 z-10">
      <button
        type="button"
        aria-label={`Share ${item.name}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-emerald-700"
      >
        <Share2 className="size-4" aria-hidden />
      </button>
      {open ? (
        <ShareSelectedPanel
          storeId={storeId}
          storeName={storeName}
          items={[item]}
          onClose={() => setOpen(false)}
          className="left-0 top-11"
        />
      ) : null}
    </div>
  )
}

function ShareSelectedPanel({
  storeId,
  storeName,
  items,
  onClose,
  className,
}: {
  storeId: string
  storeName: string
  items: ShareItem[]
  onClose: () => void
  className?: string
}) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const [instagramNote, setInstagramNote] = useState('')
  const url = shareListUrl(storeId, items)
  const message = shareMessage(storeName, items, url)
  const item = items.length === 1 ? items[0] : null
  const card = item
    ? productShareCard({
        name: item.name,
        storeName,
        unit: item.unit,
        priceLabel: item.priceLabel,
        description: item.description,
        image: item.imageUrl,
        url,
      })
    : null

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function instagram() {
    try {
      await navigator.clipboard.writeText(message)
      setInstagramNote('Copied. Paste it into Instagram.')
    } catch {
      setInstagramNote('Open Instagram and paste the product link.')
    }
    window.open(INSTAGRAM_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className={cn(
        'absolute z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="font-display text-base font-semibold text-slate-900">
          Share Product
        </h2>
        <button
          type="button"
          aria-label="Close share"
          onClick={onClose}
          className="inline-flex size-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {card ? (
        <div className="mt-3 flex items-center gap-3">
          {card.image ? (
            <img src={card.image} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{card.title}</p>
            {card.priceLine ? <p className="truncate text-sm text-slate-600">{card.priceLine}</p> : null}
            <p className="truncate text-xs text-slate-400">{card.siteName}</p>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">Share this product with friends or family.</p>
      )}
      <div className="mt-3 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{url}</span>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Or share via</p>
      <div className="mt-3 flex items-start justify-center gap-6">
        <a
          href={whatsappShareHref(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-16 flex-col items-center gap-1.5 text-xs font-medium text-slate-600"
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-[#25D366] text-white">
            <WhatsAppMark />
          </span>
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => void instagram()}
          className="flex w-16 flex-col items-center gap-1.5 text-xs font-medium text-slate-600"
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
            <InstagramMark />
          </span>
          Instagram
        </button>
        <a
          href={facebookShareHref(
            url,
            card ? [card.title, card.priceLine].filter(Boolean).join(' — ') : undefined,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-16 flex-col items-center gap-1.5 text-xs font-medium text-slate-600"
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-[#1877F2] text-white">
            <FacebookMark />
          </span>
          Facebook
        </a>
      </div>
      {instagramNote ? <p className="mt-3 text-center text-xs text-slate-500">{instagramNote}</p> : null}
    </div>
  )
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="currentColor"
        d="M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1Zm6.3-8.2a1.1 1.1 0 1 1-1.1-1.1 1.1 1.1 0 0 1 1.1 1.1ZM12 4.4c1.6 0 1.8 0 2.4.1a4.4 4.4 0 0 1 2.9 1.1 4.4 4.4 0 0 1 1.1 2.9c.1.6.1.8.1 2.4s0 1.8-.1 2.4a4.4 4.4 0 0 1-1.1 2.9 4.4 4.4 0 0 1-2.9 1.1c-.6.1-.8.1-2.4.1s-1.8 0-2.4-.1a4.4 4.4 0 0 1-2.9-1.1 4.4 4.4 0 0 1-1.1-2.9c-.1-.6-.1-.8-.1-2.4s0-1.8.1-2.4a4.4 4.4 0 0 1 1.1-2.9A4.4 4.4 0 0 1 9.6 4.5c.6-.1.8-.1 2.4-.1Zm0-1.6c-1.6 0-1.8 0-2.5.1a6 6 0 0 0-4 1.6 6 6 0 0 0-1.6 4C3.8 9.2 3.8 9.4 3.8 11s0 1.8.1 2.5a6 6 0 0 0 1.6 4 6 6 0 0 0 4 1.6c.7.1.9.1 2.5.1s1.8 0 2.5-.1a6 6 0 0 0 4-1.6 6 6 0 0 0 1.6-4c.1-.7.1-.9.1-2.5s0-1.8-.1-2.5a6 6 0 0 0-1.6-4 6 6 0 0 0-4-1.6c-.7-.1-.9-.1-2.5-.1Z"
      />
    </svg>
  )
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="currentColor"
        d="M14.5 8.5V6.8c0-.7.5-1 1.2-1H17V3h-2.1C12.2 3 11 4.4 11 6.6v1.9H9v2.8h2V21h3.5v-9.7h2.3l.4-2.8Z"
      />
    </svg>
  )
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="currentColor"
        d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5Zm-8.5 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.6.9.9-3.5-.2-.3A9.1 9.1 0 1 1 12 20.5Zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c0-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 4 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3Z"
      />
    </svg>
  )
}
