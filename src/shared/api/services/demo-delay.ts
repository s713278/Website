/**
 * Demo mode answers instantly in tests but keeps a beat in the browser.
 *
 * Shared so the dashboard services cannot drift apart on how a demo read feels — the
 * point of the delay is that demo and live mode exercise the same loading states, and
 * three separate constants made that a coincidence rather than a guarantee.
 */
const DEMO_LATENCY_MS = 150

export function demoDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS))
}
