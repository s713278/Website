import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { DESKTOP_QUERY, STAGE_QUERY, planBarVisible, resolveStageMode } from '@/modules/marketing/lib/pricing-scroll'

/**
 * Turns the feature cards into the pricing deck while stage mode applies: it sets
 * `data-pricing-stage` on the section and measures the heights the `[data-pricing-stage]` rules in
 * `global.css` need to land every card on one line: the heading block (`--pricing-head-h`), the
 * tallest card (`--pricing-card-h`) and, on desktop, the plan card (`--pricing-plan-h`). The deck
 * itself is `position: sticky` plus scroll-driven CSS, so there is no scroll listener.
 *
 * Measuring runs in a layout effect so the first painted frame is already the deck, and again on
 * any resize. Leaving stage mode removes every attribute and variable it wrote.
 */
export function usePricingStage(root: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const section = root.current
    if (!section || typeof window.matchMedia !== 'function') return
    const plan = section.querySelector<HTMLElement>('[data-pricing-plan]')
    const head = section.querySelector<HTMLElement>('[data-pricing-head]')
    const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-pricing-card]'))
    if (cards.length === 0) return

    const stageQuery = window.matchMedia(STAGE_QUERY)
    const desktopQuery = window.matchMedia(DESKTOP_QUERY)
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null
    let observing = false

    function clearHeights() {
      section!.style.removeProperty('--pricing-head-h')
      section!.style.removeProperty('--pricing-card-h')
      section!.style.removeProperty('--pricing-plan-h')
    }

    // Clear first and read everything before writing, so each measure sees natural heights and
    // never ratchets.
    function measure() {
      clearHeights()
      const headHeight = head?.offsetHeight ?? 0
      const cardHeight = Math.max(...cards.map((card) => card.offsetHeight))
      const planHeight = section!.dataset.pricingStage === 'desktop' ? plan?.offsetHeight : undefined
      section!.style.setProperty('--pricing-head-h', `${headHeight}px`)
      section!.style.setProperty('--pricing-card-h', `${cardHeight}px`)
      if (planHeight !== undefined) section!.style.setProperty('--pricing-plan-h', `${planHeight}px`)
    }

    function teardown() {
      resizeObserver?.disconnect()
      observing = false
      delete section!.dataset.pricingStage
      clearHeights()
    }

    function evaluate() {
      const mode = resolveStageMode({ stageQuery: stageQuery.matches, desktop: desktopQuery.matches })
      if (mode === 'static') {
        teardown()
        return
      }
      section!.dataset.pricingStage = mode
      measure()
      if (observing) return
      observing = true
      if (plan) resizeObserver?.observe(plan)
      if (head) resizeObserver?.observe(head)
      for (const card of cards) resizeObserver?.observe(card)
    }

    stageQuery.addEventListener('change', evaluate)
    desktopQuery.addEventListener('change', evaluate)
    evaluate()

    return () => {
      stageQuery.removeEventListener('change', evaluate)
      desktopQuery.removeEventListener('change', evaluate)
      teardown()
    }
  }, [root])
}

/**
 * Whether the compact plan bar (below `lg`) should show: once the plan card has scrolled above the
 * viewport, and not while the footnote is on screen. An IntersectionObserver only reports targets
 * whose intersecting state flipped, so a remembered rect goes stale after an instant jump (Home,
 * End, an anchor). The callback therefore reads live geometry, and the section itself is observed
 * too: any jump that changes the bar's state crosses a plan card, footnote or section edge.
 */
export function usePlanBarVisible(root: RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const section = root.current
    if (!section || typeof IntersectionObserver !== 'function') return
    const plan = section.querySelector('[data-pricing-plan]')
    const footnote = section.querySelector('[data-pricing-footnote]')
    if (!plan || !footnote) return

    const observer = new IntersectionObserver((entries) => {
      setVisible(
        planBarVisible({
          planCardBottom: plan.getBoundingClientRect().bottom,
          footnoteTop: footnote.getBoundingClientRect().top,
          viewportHeight: entries[0]?.rootBounds?.height ?? window.innerHeight,
        }),
      )
    })
    observer.observe(section)
    observer.observe(plan)
    observer.observe(footnote)
    return () => observer.disconnect()
  }, [root])
  return visible
}
