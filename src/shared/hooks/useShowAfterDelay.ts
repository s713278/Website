import { useEffect, useState } from 'react'

/** How long a loader waits before drawing, so a fast load never flashes one. */
export const LOADER_SHOW_DELAY_MS = 300

/** False until `delayMs` has passed since mount (or true at once when `startVisible`). */
export function useShowAfterDelay(delayMs = LOADER_SHOW_DELAY_MS, startVisible = false): boolean {
  const [visible, setVisible] = useState(startVisible)

  useEffect(() => {
    if (visible) return
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [visible, delayMs])

  return visible
}
