import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'
import { storeClosedMessage } from '@/modules/storefront/lib/store-subscription'
import type { Store as StoreModel } from '@/modules/storefront/types'

type StoreSubscriptionNoticeProps = {
  store: Pick<StoreModel, 'name' | 'subscriptionStatus'>
}

/** Customer-facing closed shop — not raw subscription codes. */
export function StoreSubscriptionNotice({ store }: StoreSubscriptionNoticeProps) {
  const copy = storeClosedMessage(store)

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Store className="size-7" strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-slate-900">
          {copy.title}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{copy.body}</p>
        <Link
          to="/stores"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-[var(--store-theme,var(--md-green-800))] px-6 text-sm font-semibold text-white hover:opacity-90"
        >
          Browse other shops
        </Link>
      </div>
    </main>
  )
}
