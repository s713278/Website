import { useEffect, useRef, useState, type ToggleEvent } from 'react'

/**
 * One open section at a time, opening on the first.
 *
 * Steps 5 and 6 both list a long stack of groups, and letting every one stand open
 * turns the step into a page a vendor scrolls past rather than works through. Both
 * steps share this so the two behave identically.
 */
export function useSingleOpen<T extends string | number>(ids: T[]) {
  const [openId, setOpenId] = useState<T | null>(ids[0] ?? null)
  // Keyed on the contents rather than the array, which is rebuilt on every render.
  const key = ids.join('|')
  const idsRef = useRef(ids)
  idsRef.current = ids

  // Adding or removing a group must not leave the step with nothing open.
  useEffect(() => {
    setOpenId((current) => {
      const list = idsRef.current
      return current !== null && list.includes(current) ? current : list[0] ?? null
    })
  }, [key])

  const onToggle = (id: T) => (event: ToggleEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open
    setOpenId((current) => {
      if (isOpen) return id
      // A close fires for the previously open panel too, after the new one has claimed
      // the slot. Only the panel that still holds it may give it up.
      return current === id ? null : current
    })
  }

  return { openId, setOpenId, onToggle }
}
