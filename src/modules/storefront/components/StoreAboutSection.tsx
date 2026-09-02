import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type StoreAboutSectionProps = {
  storeName: string
  description: string
  className?: string
}

/** Full-width about copy — clamps long text with More / Less. */
export function StoreAboutSection({ storeName, description, className }: StoreAboutSectionProps) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [needsToggle, setNeedsToggle] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [description])

  useEffect(() => {
    const el = textRef.current
    if (!el) return

    function measure() {
      if (!el || expanded) return
      setNeedsToggle(el.scrollHeight > el.clientHeight + 1)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [description, expanded])

  return (
    <section className={cn(className)}>
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--store-accent,#ea580c)] sm:text-[13px]">
        About {storeName}
      </h2>
      <p
        ref={textRef}
        className={cn(
          'mt-2 w-full text-sm leading-6 text-slate-600 sm:text-[15px]',
          !expanded && 'line-clamp-3',
        )}
      >
        {description}
      </p>
      {needsToggle || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-1.5 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      ) : null}
    </section>
  )
}
