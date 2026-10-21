/** The deck needs room for the pinned cards and no reduced-motion preference. */
export const STAGE_QUERY = '(min-width: 768px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)'

/** Selects desktop over tablet inside stage mode. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

export type StageMode = 'static' | 'tablet' | 'desktop'

export function resolveStageMode(input: { stageQuery: boolean; desktop: boolean }): StageMode {
  if (!input.stageQuery) return 'static'
  return input.desktop ? 'desktop' : 'tablet'
}

/**
 * The bar shows once the plan card has slid under the sticky header (its bottom at or above
 * `topInset`, the header's bottom edge) and until the footnote enters the viewport.
 */
export function planBarVisible(input: {
  planCardBottom: number
  topInset: number
  footnoteTop: number
  viewportHeight: number
}): boolean {
  return input.planCardBottom <= input.topInset && input.footnoteTop > input.viewportHeight
}
