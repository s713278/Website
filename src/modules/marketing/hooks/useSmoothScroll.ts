import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

/**
 * Smooths wheel scrolling on the page that mounts it, and glides same-page anchor links (they still
 * honour each target's `scroll-margin-top`). Lenis drives the real window scroll, so sticky
 * positioning and scroll-driven CSS keep working. Touch stays native, a reduced-motion preference
 * skips it entirely, and wheel input passes through untouched where the page must not move: over
 * a nested scroller (`allowNestedScroll`) and while a dialog or menu holds the scroll lock, which
 * Radix marks with `data-scroll-locked` on the body.
 */
export function useSmoothScroll(): void {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({
      autoRaf: true,
      anchors: true,
      allowNestedScroll: true,
      prevent: () => document.body.hasAttribute('data-scroll-locked'),
    })
    return () => lenis.destroy()
  }, [])
}
