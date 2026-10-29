import { useEffect, useMemo, useRef, useState } from 'react'
import { relativeDay } from '@/modules/vendor/lib/billing-prototype-card'
import { keptLiveHistory, readLiveHistory } from '@/modules/vendor/store/live-billing'
import { getErrorMessage, mapLiveBillingHistory, type LiveBillingView } from '@/shared/api'
import { Button } from '@/shared/components/ui'

interface LivePaymentsYouMadeProps {
  vendorId: string
  /** The shared read's view: one from a changed subscription response rereads the history, a cancel response included. */
  view: LiveBillingView
  /** The shared read is in flight; the history waits for it to land. */
  reading: boolean
  trialStartedAt: string | null
  /** Counts the writes that return no view, such as `confirm`; each one rereads the history. */
  writes: number
}

/**
 * "Payments you made" with the Live API. Only Plan reads the history, apart from the shared read, so
 * a failure here shows only in this section. A failed reread keeps the last rows beside the error.
 */
export function LivePaymentsYouMade({ vendorId, view, reading, trialStartedAt, writes }: LivePaymentsYouMadeProps) {
  // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md. The kept history shows at once.
  const [history, setHistory] = useState<{ events: unknown } | null>(() => {
    const kept = keptLiveHistory(vendorId)
    return kept === undefined ? null : { events: kept }
  })
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
  /** The write and Try again counts the last good history read covers; a newer one forces a reread. */
  const covered = useRef({ writes, attempt })

  // Rereads when the shared read lands from a changed subscription response, after a write, and on
  // Try again; otherwise the kept history stands. A newer reason drops the read in flight.
  // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
  useEffect(() => {
    if (reading) return
    const forced = writes !== covered.current.writes || attempt !== covered.current.attempt
    const kept = forced ? undefined : keptLiveHistory(vendorId)
    if (kept !== undefined) {
      setHistory((last) => last?.events === kept ? last : { events: kept })
      setError(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    readLiveHistory(vendorId, controller.signal).then(
      (events) => {
        if (controller.signal.aborted) return
        covered.current = { writes, attempt }
        setHistory({ events })
        setError(null)
        setLoading(false)
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause)
        setLoading(false)
      },
    )
    return () => { controller.abort() }
  }, [vendorId, view, reading, writes, attempt])

  const mapped = useMemo(() => {
    if (!history) return { rows: null, error: null }
    try {
      return { rows: mapLiveBillingHistory(history.events, trialStartedAt), error: null }
    } catch (cause) {
      return { rows: null, error: cause }
    }
  }, [history, trialStartedAt])
  const failure = error ?? mapped.error
  const now = new Date()

  return <>
    {failure ? <div className="grid gap-2 text-sm">
      <p role="alert" className="text-destructive">{getErrorMessage(failure)}</p>
      <Button className="w-fit" variant="outline" size="sm" disabled={loading} onClick={() => setAttempt((count) => count + 1)}>Try again</Button>
    </div> : null}
    {mapped.rows === null ? failure ? null : <p role="status" className="text-sm text-muted-foreground">Reading payments…</p>
      : mapped.rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        : <ul className="grid gap-2">
          {mapped.rows.map((row, index) => <li key={index} className="rounded-xl border bg-muted/30 px-3 py-2.5">
            <p className="text-sm font-semibold">{row.title}</p>
            <p className="text-xs text-muted-foreground">{row.amount === null ? '' : `₹${row.amount} · `}{relativeDay(row.at, now)}</p>
          </li>)}
        </ul>}
  </>
}
